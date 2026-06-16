-- Phase 4: interactive social feed — reactions, comments, co-op blooms, harvest cards.

-- 1. Extend activity_events for richer dispatches --------------------------------
alter table public.activity_events
  add column if not exists co_actor_id uuid references public.profiles(id) on delete cascade,
  add column if not exists session_count int,
  add column if not exists details jsonb;

-- Expand the dispatch kind enum. Drop/re-add is idempotent.
alter table public.activity_events
  drop constraint if exists activity_events_kind_check;
alter table public.activity_events
  add constraint activity_events_kind_check check (kind in ('session', 'milestone', 'summary', 'bloom'));

create index if not exists activity_events_co_actor_idx
  on public.activity_events (co_actor_id) where co_actor_id is not null;

-- One bloom per friendship pair / language / day.
create unique index if not exists activity_events_bloom_unique_idx
  on public.activity_events (actor_id, co_actor_id, language_name, occurred_on)
  where kind = 'bloom';

-- 2. Reactions ------------------------------------------------------------------
create table if not exists public.event_reactions (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.activity_events(id) on delete cascade,
  reactor_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  created_at timestamptz not null default now(),
  constraint event_reactions_unique unique (event_id, reactor_id, kind)
);

create index if not exists event_reactions_event_idx
  on public.event_reactions (event_id, kind);

alter table public.event_reactions enable row level security;

-- 3. Comments -------------------------------------------------------------------
create table if not exists public.event_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.activity_events(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists event_comments_event_idx
  on public.event_comments (event_id, created_at);

alter table public.event_comments enable row level security;

-- 4. Visibility helper: can the current user see a given dispatch? --------------
--    Shared by RLS policies on activity_events, event_reactions, event_comments.
create or replace function public.can_see_dispatch(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.activity_events e
    where e.id = eid
      and (
        e.actor_id = auth.uid()
        or public.are_friends(auth.uid(), e.actor_id)
        or (e.co_actor_id is not null and (e.co_actor_id = auth.uid() or public.are_friends(auth.uid(), e.co_actor_id)))
      )
  );
$$;

-- 5. Refresh activity_events select policy to cover co_actor --------------------
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='activity_events' and policyname='Dispatches are visible to self and friends') then
    drop policy "Dispatches are visible to self and friends" on public.activity_events;
  end if;

  create policy "Dispatches are visible to self and friends"
    on public.activity_events for select to authenticated
    using (public.can_see_dispatch(id));
end $$;

-- 6. Reactions policies ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_reactions' and policyname='Reactions visible on visible dispatches') then
    create policy "Reactions visible on visible dispatches"
      on public.event_reactions for select to authenticated
      using (public.can_see_dispatch(event_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_reactions' and policyname='Users react to visible dispatches') then
    create policy "Users react to visible dispatches"
      on public.event_reactions for insert to authenticated
      with check (
        reactor_id = auth.uid()
        and public.can_see_dispatch(event_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_reactions' and policyname='Reactors can remove their reactions') then
    create policy "Reactors can remove their reactions"
      on public.event_reactions for delete to authenticated
      using (reactor_id = auth.uid());
  end if;
end $$;

-- 7. Comments policies ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_comments' and policyname='Comments visible on visible dispatches') then
    create policy "Comments visible on visible dispatches"
      on public.event_comments for select to authenticated
      using (public.can_see_dispatch(event_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_comments' and policyname='Users comment on visible dispatches') then
    create policy "Users comment on visible dispatches"
      on public.event_comments for insert to authenticated
      with check (
        author_id = auth.uid()
        and public.can_see_dispatch(event_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_comments' and policyname='Authors can delete their comments') then
    create policy "Authors can delete their comments"
      on public.event_comments for delete to authenticated
      using (author_id = auth.uid());
  end if;
end $$;

-- 8. Trigger: session + milestone + co-op bloom ---------------------------------
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
  v_friend  uuid;
begin
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

  -- Milestones and blooms only happen for sessions logged today, so backfilling
  -- old entries doesn't generate stale social noise.
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

    -- Co-op bloom: a friend studied the same language today. Canonicalise the
    -- pair so the unique index prevents duplicate blooms when the second friend
    -- logs their session later.
    for v_friend in
      select distinct e.user_id
      from public.entries e
      where e.user_id <> NEW.user_id
        and e.language_id = NEW.language_id
        and e.date = NEW.date
        and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and (
              (f.requester_id = NEW.user_id and f.addressee_id = e.user_id) or
              (f.addressee_id = NEW.user_id and f.requester_id = e.user_id)
            )
        )
    loop
      insert into public.activity_events
        (actor_id, co_actor_id, kind, language_name, language_color, occurred_on)
      values
        (least(NEW.user_id, v_friend), greatest(NEW.user_id, v_friend), 'bloom', v_name, v_color, NEW.date)
      on conflict (actor_id, co_actor_id, language_name, occurred_on) where kind = 'bloom'
      do nothing;
    end loop;
  end if;

  return NEW;
end;
$$;

-- 9. Weekly harvest: richer summary dispatches ----------------------------------
create or replace function public.share_weekly_summary()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', current_date)::date;
  v_mins       int;
  v_sessions   int;
  v_top_name   text;
  v_top_color  text;
  v_top_mins   int;
  v_details    jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'no profile';
  end if;

  select coalesce(sum(hours * 60 + minutes), 0)::int,
         count(*)
  into v_mins, v_sessions
  from entries
  where user_id = auth.uid()
    and date >= v_week_start
    and date <= current_date;

  select l.name, l.color, sum(e.hours * 60 + e.minutes)::int
  into v_top_name, v_top_color, v_top_mins
  from entries e
  join languages l on l.user_id = e.user_id and l.id = e.language_id
  where e.user_id = auth.uid()
    and e.date >= v_week_start
    and e.date <= current_date
  group by l.name, l.color
  order by sum(e.hours * 60 + e.minutes) desc
  limit 1;

  v_details := jsonb_build_object(
    'session_count', v_sessions,
    'top_language', jsonb_build_object(
      'name', v_top_name,
      'color', v_top_color,
      'minutes', v_top_mins
    ),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'color', t.color, 'minutes', t.mins) order by t.mins desc)
      from (
        select l.name, l.color, sum(e.hours * 60 + e.minutes)::int as mins
        from entries e
        join languages l on l.user_id = e.user_id and l.id = e.language_id
        where e.user_id = auth.uid()
          and e.date >= v_week_start
          and e.date <= current_date
        group by l.name, l.color
      ) t
    ), '[]'::jsonb)
  );

  -- Replace any previously shared harvest for this week so re-sharing
  -- backfills old phase-3 dispatches instead of leaving them behind.
  delete from activity_events
  where actor_id = auth.uid()
    and kind = 'summary'
    and occurred_on >= v_week_start
    and occurred_on <= current_date;

  insert into activity_events (actor_id, kind, minutes, language_name, language_color, session_count, occurred_on, details)
  values (auth.uid(), 'summary', v_mins, v_top_name, v_top_color, v_sessions, current_date, v_details);
end;
$$;

-- 10. Realtime ------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_reactions'
  ) then
    alter publication supabase_realtime add table public.event_reactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_comments'
  ) then
    alter publication supabase_realtime add table public.event_comments;
  end if;
end $$;

-- 11. Grants --------------------------------------------------------------------
grant execute on function public.can_see_dispatch(uuid) to authenticated;
grant select, insert, delete on public.event_reactions to authenticated;
grant select, insert, delete on public.event_comments to authenticated;
