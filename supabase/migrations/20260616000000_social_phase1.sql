-- Social layer, Phase 1: Friends.
--
-- Adds the public-handle table (profiles) and the relationship table
-- (friendships), plus the read-only RPCs that power friend discovery and the
-- friends list. Idempotent so it can be applied to a fresh or existing project.
--
-- Privacy model (the whole point of doing it this way):
--   * Raw `entries` / `languages` RLS is left UNTOUCHED — still owner-only. A
--     friend can never read your sessions or your private notes.
--   * `profiles` exposes only a chosen handle + display name, and only to you
--     and people you already have a friendship row with. Discovery happens
--     exclusively through the `search_users` RPC, which is capped and prefix-
--     matched so the directory can't be scraped.
--   * The friends list (streak, active languages, weekly minutes) is computed
--     server-side by the SECURITY DEFINER `friends_overview` function and
--     returns ONLY safe aggregates — raw rows never cross the boundary.

-- 1. Tables -----------------------------------------------------------------

-- Opt-in public handle. No row here = invisible, exactly like a solo user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

-- One row per relationship. `requester` sent it, `addressee` accepts it.
-- A canonical-pair unique index makes A->B and B->A mutually exclusive.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  addressee_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_requester_id_fkey
    foreign key (requester_id) references public.profiles(id) on delete cascade,
  constraint friendships_addressee_id_fkey
    foreign key (addressee_id) references public.profiles(id) on delete cascade,
  constraint friendships_status_check check (status in ('pending', 'accepted')),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx
  on public.friendships (requester_id, status);

-- 2. Helper: current activity streak (any language) for a user --------------
--    Mirrors the JS `currentStreak` in src/lib/date.js: consecutive days
--    counting back from today. Uses date arithmetic (no timezone drift).
--    Intentionally NOT granted to `authenticated` — it reads another user's
--    entries, so it is only ever called from within friends_overview (which
--    runs as owner and restricts to accepted friends).
create or replace function public.current_streak_for(uid uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_streak int := 0;
  v_dates  date[];
  v_d      date;
  v_diff   int;
begin
  select array_agg(d order by d desc)
    into v_dates
    from (select distinct date as d from public.entries where user_id = uid) s;

  if v_dates is null then
    return 0;
  end if;

  foreach v_d in array v_dates loop
    v_diff := current_date - v_d;
    if v_diff = v_streak then
      v_streak := v_streak + 1;
    elsif v_diff > v_streak then
      exit;
    end if;
  end loop;

  return v_streak;
end;
$$;

-- 3. Discovery RPC: prefix search by username -------------------------------
--    The only way to read a non-friend's profile. Requires >= 2 chars,
--    excludes you and anyone you already have a friendship with, hides
--    non-discoverable users, and caps results so the directory can't be dumped.
create or replace function public.search_users(q text)
returns table (id uuid, username text, display_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q text := lower(trim(coalesce(q, '')));
begin
  if length(v_q) < 2 then
    return;
  end if;

  -- Escape LIKE wildcards (underscore is a legal username char).
  v_q := replace(v_q, '\', '\\');
  v_q := replace(v_q, '%', '\%');
  v_q := replace(v_q, '_', '\_');

  return query
    select p.id, p.username, p.display_name
    from public.profiles p
    where p.discoverable
      and p.id <> auth.uid()
      and p.username like v_q || '%' escape '\'
      and not exists (
        select 1 from public.friendships f
        where (f.requester_id = auth.uid() and f.addressee_id = p.id)
           or (f.addressee_id = auth.uid() and f.requester_id = p.id)
      )
    order by p.username
    limit 10;
end;
$$;

-- 4. Friends-list RPC: safe aggregates per accepted friend ------------------
--    Returns the streak, the languages they've touched in the last 14 days
--    (name + color, top 3 by minutes), when they were last active, and minutes
--    logged this week. No sessions, no notes — only computed summaries.
create or replace function public.friends_overview()
returns table (
  friendship_id    uuid,
  friend_id        uuid,
  username         text,
  display_name     text,
  current_streak   int,
  last_active      date,
  minutes_this_week int,
  active_languages jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    fr.friendship_id,
    fr.friend_id,
    pr.username,
    pr.display_name,
    public.current_streak_for(fr.friend_id) as current_streak,
    (select max(e.date) from public.entries e where e.user_id = fr.friend_id) as last_active,
    coalesce((
      select sum(e.hours * 60 + e.minutes)::int
      from public.entries e
      where e.user_id = fr.friend_id
        and e.date >= date_trunc('week', current_date)::date
    ), 0) as minutes_this_week,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'color', t.color) order by t.mins desc)
      from (
        select l.name, l.color, sum(e.hours * 60 + e.minutes) as mins
        from public.entries e
        join public.languages l
          on l.user_id = e.user_id and l.id = e.language_id
        where e.user_id = fr.friend_id
          and e.date >= current_date - 14
        group by l.name, l.color
        order by mins desc
        limit 3
      ) t
    ), '[]'::jsonb) as active_languages
  from (
    select
      f.id as friendship_id,
      case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  ) fr
  join public.profiles pr on pr.id = fr.friend_id
  order by pr.display_name;
$$;

-- 5. Row Level Security -----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

-- profiles: visible to yourself and to anyone you have a friendship row with
-- (covers the friends list, pending requests, and feed name resolution later).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Profiles are visible to self and connections') then
    create policy "Profiles are visible to self and connections"
      on public.profiles for select to authenticated
      using (
        id = auth.uid()
        or exists (
          select 1 from public.friendships f
          where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
             or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can create their own profile') then
    create policy "Users can create their own profile"
      on public.profiles for insert to authenticated
      with check (id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can update their own profile') then
    create policy "Users can update their own profile"
      on public.profiles for update to authenticated
      using (id = auth.uid()) with check (id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can delete their own profile') then
    create policy "Users can delete their own profile"
      on public.profiles for delete to authenticated
      using (id = auth.uid());
  end if;
end $$;

-- friendships: you can see, create, accept, and remove only your own.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='friendships' and policyname='Members can view their friendships') then
    create policy "Members can view their friendships"
      on public.friendships for select to authenticated
      using (requester_id = auth.uid() or addressee_id = auth.uid());
  end if;

  -- You may only send a request AS yourself, and only in the pending state.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='friendships' and policyname='Users can send friend requests') then
    create policy "Users can send friend requests"
      on public.friendships for insert to authenticated
      with check (requester_id = auth.uid() and status = 'pending');
  end if;

  -- Only the addressee can accept (or otherwise change) a request to them.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='friendships' and policyname='Addressee can respond to requests') then
    create policy "Addressee can respond to requests"
      on public.friendships for update to authenticated
      using (addressee_id = auth.uid())
      with check (addressee_id = auth.uid() and status in ('pending', 'accepted'));
  end if;

  -- Either party can cancel a request, decline one, or unfriend.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='friendships' and policyname='Members can remove friendships') then
    create policy "Members can remove friendships"
      on public.friendships for delete to authenticated
      using (requester_id = auth.uid() or addressee_id = auth.uid());
  end if;
end $$;

-- 6. Grants -----------------------------------------------------------------
--    This project does not auto-expose new tables to the API roles, so grant
--    explicitly. Authenticated only — never anon.

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.friends_overview() to authenticated;
-- current_streak_for is intentionally NOT granted: internal use only.
