-- Grow buddies: a pact between two friends to grow a shared language toward a
-- combined weekly goal, with a joint streak. Unlike solo commitments, progress
-- pools both gardeners' minutes — so checking in on each other is intrinsic.
--
--   * buddy_pacts          — the pact (proposed → accepted → ended), one active
--                            pact per friend-pair per language.
--   * buddy_pacts_with_progress() — accepted + pending pacts for the caller,
--                            with this-week combined/per-gardener minutes and a
--                            joint streak (consecutive weeks the pair hit goal).

-- 1. Table ---------------------------------------------------------------------

create table if not exists public.buddy_pacts (
  id              uuid primary key default gen_random_uuid(),
  proposer_id     uuid not null references public.profiles(id) on delete cascade,
  -- Canonical ordering (user_a < user_b) makes the pair unique regardless of
  -- who proposed; proposer_id still records direction for the invite inbox.
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  language_name   text not null,
  language_color  text not null default '#9ca3af',
  target_minutes  int not null check (target_minutes > 0),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'ended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint buddy_pacts_pair_order check (user_a < user_b),
  constraint buddy_pacts_proposer_is_member check (proposer_id = user_a or proposer_id = user_b)
);

-- One live pact (pending or accepted) per pair per language; ended pacts free
-- the slot so a pair can re-plant the same language later.
create unique index if not exists buddy_pacts_active_unique_idx
  on public.buddy_pacts (user_a, user_b, language_name)
  where status <> 'ended';

create index if not exists buddy_pacts_members_idx
  on public.buddy_pacts (user_a, user_b, status);

-- 2. Helpers -------------------------------------------------------------------

-- Combined minutes for one or two gardeners in a named language over a date
-- range. Passing the same id twice yields a single gardener's total.
create or replace function public.buddy_combined_minutes(
  p_user_a uuid,
  p_user_b uuid,
  p_language_name text,
  p_from date,
  p_to date
)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(e.hours * 60 + e.minutes), 0)::int
  from public.entries e
  join public.languages l on l.user_id = e.user_id and l.id = e.language_id
  where e.user_id in (p_user_a, p_user_b)
    and l.name = p_language_name
    and e.date >= p_from
    and e.date <= p_to;
$$;

-- Consecutive weeks the pair met the combined goal. The in-progress current
-- week only counts once met, so an unfinished week never breaks the streak.
create or replace function public.buddy_joint_streak(
  p_user_a uuid,
  p_user_b uuid,
  p_language_name text,
  p_target int
)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_week  date := date_trunc('week', current_date)::date;
  v_count int := 0;
begin
  if public.buddy_combined_minutes(p_user_a, p_user_b, p_language_name, v_week, v_week + 6) < p_target then
    v_week := v_week - 7;
  end if;

  while public.buddy_combined_minutes(p_user_a, p_user_b, p_language_name, v_week, v_week + 6) >= p_target
        and v_count < 104 loop
    v_count := v_count + 1;
    v_week := v_week - 7;
  end loop;

  return v_count;
end;
$$;

-- 3. Progress RPC --------------------------------------------------------------

-- All live pacts involving the caller, with this-week progress and joint streak.
-- SECURITY DEFINER so it can read the buddy's entries while the tables stay
-- private; the WHERE clause still scopes results to the caller's own pacts.
create or replace function public.buddy_pacts_with_progress()
returns table (
  id               uuid,
  proposer_id      uuid,
  user_a           uuid,
  user_b           uuid,
  language_name    text,
  language_color   text,
  target_minutes   int,
  status           text,
  created_at       timestamptz,
  buddy_id         uuid,
  buddy_name       text,
  combined_minutes int,
  my_minutes       int,
  buddy_minutes    int,
  joint_streak     int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_week date := date_trunc('week', current_date)::date;
begin
  return query
    select
      p.id,
      p.proposer_id,
      p.user_a,
      p.user_b,
      p.language_name,
      p.language_color,
      p.target_minutes,
      p.status,
      p.created_at,
      b.id as buddy_id,
      coalesce(b.display_name, b.username) as buddy_name,
      public.buddy_combined_minutes(p.user_a, p.user_b, p.language_name, v_week, current_date) as combined_minutes,
      public.buddy_combined_minutes(v_uid, v_uid, p.language_name, v_week, current_date) as my_minutes,
      public.buddy_combined_minutes(
        case when p.user_a = v_uid then p.user_b else p.user_a end,
        case when p.user_a = v_uid then p.user_b else p.user_a end,
        p.language_name, v_week, current_date
      ) as buddy_minutes,
      public.buddy_joint_streak(p.user_a, p.user_b, p.language_name, p.target_minutes) as joint_streak
    from public.buddy_pacts p
    join public.profiles b
      on b.id = case when p.user_a = v_uid then p.user_b else p.user_a end
    where p.status <> 'ended'
      and (p.user_a = v_uid or p.user_b = v_uid)
    order by p.created_at desc;
end;
$$;

-- 4. RLS -----------------------------------------------------------------------

alter table public.buddy_pacts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_pacts' and policyname='Pacts visible to members') then
    create policy "Pacts visible to members"
      on public.buddy_pacts for select to authenticated
      using (user_a = auth.uid() or user_b = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_pacts' and policyname='Members propose pacts to friends') then
    create policy "Members propose pacts to friends"
      on public.buddy_pacts for insert to authenticated
      with check (
        proposer_id = auth.uid()
        and (user_a = auth.uid() or user_b = auth.uid())
        and public.are_friends(user_a, user_b)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_pacts' and policyname='Members update their pacts') then
    create policy "Members update their pacts"
      on public.buddy_pacts for update to authenticated
      using (user_a = auth.uid() or user_b = auth.uid())
      with check (user_a = auth.uid() or user_b = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_pacts' and policyname='Members remove their pacts') then
    create policy "Members remove their pacts"
      on public.buddy_pacts for delete to authenticated
      using (user_a = auth.uid() or user_b = auth.uid());
  end if;
end $$;

-- 5. Realtime ------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buddy_pacts'
  ) then
    alter publication supabase_realtime add table public.buddy_pacts;
  end if;
end $$;

-- 6. Grants --------------------------------------------------------------------

grant execute on function public.buddy_combined_minutes(uuid, uuid, text, date, date) to authenticated;
grant execute on function public.buddy_joint_streak(uuid, uuid, text, int) to authenticated;
grant execute on function public.buddy_pacts_with_progress() to authenticated;
grant select, insert, update, delete on public.buddy_pacts to authenticated;
