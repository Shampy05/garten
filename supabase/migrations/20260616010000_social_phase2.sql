-- Social layer, Phase 2: Activity feed (garden dispatches).
--
-- A friend-readable, append-only stream of denormalized dispatches. The whole
-- table is written ONLY by a SECURITY DEFINER trigger on `entries` — clients
-- cannot insert (so dispatches can't be forged) and the raw session, including
-- the private `notes` field, never appears here. RLS lets you read your own
-- dispatches and those of accepted friends, and Realtime broadcasts inserts
-- under the same policy.

-- 1. Helper: are two users accepted friends? --------------------------------
--    Deferred from Phase 1; needed by the feed's RLS (and by Phase 3). Runs as
--    definer so a SELECT policy can call it without RLS recursion on friendships.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b) or
        (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

-- 2. The dispatch stream ----------------------------------------------------
create table if not exists public.activity_events (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid not null,
  kind           text not null,
  language_name  text,
  language_color text,
  activity_type  text,
  minutes        int,
  streak_days    int,
  occurred_on    date not null,
  created_at     timestamptz not null default now(),
  constraint activity_events_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade,
  -- 'summary' is reserved for Phase 3 so we don't have to alter this later.
  constraint activity_events_kind_check check (kind in ('session', 'milestone', 'summary'))
);

create index if not exists activity_events_actor_created_idx
  on public.activity_events (actor_id, created_at desc);

-- A given streak milestone for a language is announced at most once, ever —
-- no re-announcing the same threshold if a streak is rebuilt later.
create unique index if not exists activity_events_milestone_unique_idx
  on public.activity_events (actor_id, language_name, streak_days)
  where kind = 'milestone';

-- 3. The writer: one trigger turns a logged session into dispatches ----------
create or replace function public.handle_new_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name    text;
  v_color   text;
  v_minutes int;
  v_streak  int := 0;
  v_dates   date[];
  v_d       date;
  v_diff    int;
begin
  -- Only emit dispatches for users who've opted into social (have a profile).
  -- Purely solo users generate zero social data.
  if not exists (select 1 from public.profiles where id = NEW.user_id) then
    return NEW;
  end if;

  select l.name, l.color into v_name, v_color
  from public.languages l
  where l.user_id = NEW.user_id and l.id = NEW.language_id;

  v_minutes := (coalesce(NEW.hours, 0) * 60 + coalesce(NEW.minutes, 0))::int;

  insert into public.activity_events
    (actor_id, kind, language_name, language_color, activity_type, minutes, occurred_on)
  values
    (NEW.user_id, 'session', v_name, v_color, NEW.type, v_minutes, NEW.date);

  -- Milestones only for sessions logged today, so backfilling old entries
  -- doesn't fire stale streak announcements.
  if NEW.date = current_date then
    select array_agg(d order by d desc) into v_dates
    from (
      select distinct date as d
      from public.entries
      where user_id = NEW.user_id and language_id = NEW.language_id
    ) s;

    if v_dates is not null then
      foreach v_d in array v_dates loop
        v_diff := current_date - v_d;
        if v_diff = v_streak then
          v_streak := v_streak + 1;
        elsif v_diff > v_streak then
          exit;
        end if;
      end loop;
    end if;

    if v_streak = any (array[7, 14, 30, 50, 100, 200, 365]) then
      insert into public.activity_events
        (actor_id, kind, language_name, language_color, streak_days, occurred_on)
      values
        (NEW.user_id, 'milestone', v_name, v_color, v_streak, current_date)
      on conflict (actor_id, language_name, streak_days) where kind = 'milestone'
      do nothing;
    end if;
  end if;

  return NEW;
end;
$$;

create or replace trigger entries_activity_event
  after insert on public.entries
  for each row execute function public.handle_new_entry();

-- 4. Row Level Security -----------------------------------------------------
alter table public.activity_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_events' and policyname='Dispatches are visible to self and friends') then
    create policy "Dispatches are visible to self and friends"
      on public.activity_events for select to authenticated
      using (actor_id = auth.uid() or public.are_friends(auth.uid(), actor_id));
  end if;

  -- No INSERT/UPDATE policy: the SECURITY DEFINER trigger is the only writer.
  -- You may remove your own dispatches, though.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_events' and policyname='Authors can remove their dispatches') then
    create policy "Authors can remove their dispatches"
      on public.activity_events for delete to authenticated
      using (actor_id = auth.uid());
  end if;
end $$;

-- 5. Grants -----------------------------------------------------------------
grant select, delete on public.activity_events to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- 6. Realtime ---------------------------------------------------------------
--    Add to the publication so postgres_changes broadcasts inserts. RLS above
--    is enforced per-subscriber, so each client only receives dispatches it is
--    allowed to read.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_events'
  ) then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end $$;
