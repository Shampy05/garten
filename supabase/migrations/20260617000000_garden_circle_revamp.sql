-- Garden Circle revamp: replaces the passive "Garden dispatches" feed with an
-- accountability + presence social layer.
--
-- Changes:
--   * New tables: circle_commitments, focus_sessions.
--   * activity_events gains commitment_progress and circle_report kinds; the old
--     summary kind is kept in the enum only for backwards compatibility, but
--     all summary rows are deleted and no new ones are created.
--   * handle_new_entry() no longer emits per-session dispatches; it still emits
--     milestones and blooms, and now emits commitment_progress events.
--   * New RPC: circle_leaderboard(window) returns safe aggregates for self + friends.
--   * New RPC: generate_circle_report() creates the weekly per-user report.
--   * Focus sessions auto-log entries when completed by the client or expired
--     server-side.

-- 1. New tables ----------------------------------------------------------------

create table if not exists public.circle_commitments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  week_start      date not null,
  language_id     text not null,
  language_name   text not null,
  language_color  text not null default '#9ca3af',
  target_minutes  int not null check (target_minutes > 0),
  created_at      timestamptz not null default now(),
  constraint circle_commitments_language_fk
    foreign key (user_id, language_id)
    references public.languages(user_id, id)
    on delete cascade
);

create unique index if not exists circle_commitments_unique_idx
  on public.circle_commitments (user_id, week_start, language_id);

create index if not exists circle_commitments_user_week_idx
  on public.circle_commitments (user_id, week_start);


create table if not exists public.focus_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  language_id       text not null,
  language_name     text not null,
  language_color    text not null default '#9ca3af',
  activity_type     text not null default 'vocabulary',
  duration_minutes  int not null check (duration_minutes > 0),
  started_at        timestamptz not null default now(),
  ends_at           timestamptz not null,
  status            text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  parent_session_id uuid references public.focus_sessions(id) on delete set null,
  constraint focus_sessions_language_fk
    foreign key (user_id, language_id)
    references public.languages(user_id, id)
    on delete cascade
);

create index if not exists focus_sessions_user_status_idx
  on public.focus_sessions (user_id, status, ends_at);

create index if not exists focus_sessions_active_idx
  on public.focus_sessions (status, ends_at) where status = 'active';


create table if not exists public.nudges (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('cheer', 'nudge')),
  commitment_id   uuid references public.circle_commitments(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index if not exists nudges_recipient_idx
  on public.nudges (recipient_id, created_at desc);

-- 2. Update activity_events kind enum ------------------------------------------

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check
    check (kind in ('session', 'milestone', 'summary', 'bloom', 'commitment_progress', 'circle_report'));

-- Delete all old weekly harvest / summary dispatches.
delete from public.activity_events where kind = 'summary';

-- Per-session dispatches are no longer created; remove existing ones too.
delete from public.activity_events where kind = 'session';

-- 3. Helpers -------------------------------------------------------------------

-- Are two users accepted friends? Used by RLS and leaderboard.
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
        (f.requester_id = a and f.addressee_id = b)
        or (f.addressee_id = a and f.requester_id = b)
      )
  );
$$;

-- 4. Commitment progress -------------------------------------------------------

-- Emit a commitment_progress dispatch when a user crosses 50% or 100% of their
-- weekly commitment for the first time. Called from handle_new_entry().
create or replace function public.check_commitment_progress(
  p_user_id uuid,
  p_language_id uuid,
  p_language_name text,
  p_language_color text,
  p_occurred_on date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start date := date_trunc('week', p_occurred_on)::date;
  v_commitment record;
  v_logged_mins int;
  v_ratio numeric;
  v_milestone int;
begin
  for v_commitment in
    select *
    from public.circle_commitments
    where user_id = p_user_id
      and week_start = v_week_start
      and language_id = p_language_id
  loop
    select coalesce(sum(e.hours * 60 + e.minutes), 0)::int
    into v_logged_mins
    from public.entries e
    where e.user_id = p_user_id
      and e.language_id = p_language_id
      and e.date >= v_week_start
      and e.date <= p_occurred_on;

    v_ratio := v_logged_mins::numeric / nullif(v_commitment.target_minutes, 0);

    -- Pick the highest milestone reached on this crossing.
    if v_ratio >= 1 then
      v_milestone := 100;
    elsif v_ratio >= 0.5 then
      v_milestone := 50;
    else
      continue;
    end if;

    -- Only emit once per milestone per commitment.
    if exists (
      select 1 from public.activity_events
      where actor_id = p_user_id
        and kind = 'commitment_progress'
        and occurred_on >= v_week_start
        and occurred_on <= p_occurred_on
        and (details ->> 'language_id') = p_language_id
        and (details ->> 'milestone')::int = v_milestone
    ) then
      continue;
    end if;

    insert into public.activity_events
      (actor_id, kind, language_name, language_color, minutes, occurred_on, details)
    values
      (
        p_user_id,
        'commitment_progress',
        p_language_name,
        p_language_color,
        v_logged_mins,
        p_occurred_on,
        jsonb_build_object(
          'milestone', v_milestone,
          'target_minutes', v_commitment.target_minutes,
          'logged_minutes', v_logged_mins,
          'language_id', p_language_id,
          'week_start', v_week_start
        )
      );
  end loop;
end;
$$;

-- 5. Circle report -------------------------------------------------------------

-- Generates a weekly report dispatch for the current user. Idempotent: calling
-- it again for the same week replaces the previous report.
create or replace function public.generate_circle_report()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start date := date_trunc('week', current_date)::date;
  v_mins       int;
  v_sessions   int;
  v_top_name   text;
  v_top_color  text;
  v_top_mins   int;
  v_details    jsonb;
  v_commitment jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'no profile';
  end if;

  select coalesce(sum(e.hours * 60 + e.minutes), 0)::int,
         count(*)::int
  into v_mins, v_sessions
  from public.entries e
  where e.user_id = auth.uid()
    and e.date >= v_week_start
    and e.date <= current_date;

  select l.name, l.color, sum(e.hours * 60 + e.minutes)::int
  into v_top_name, v_top_color, v_top_mins
  from public.entries e
  join public.languages l on l.user_id = e.user_id and l.id = e.language_id
  where e.user_id = auth.uid()
    and e.date >= v_week_start
    and e.date <= current_date
  group by l.name, l.color
  order by sum(e.hours * 60 + e.minutes) desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'language_id', c.language_id,
    'language_name', c.language_name,
    'language_color', c.language_color,
    'target_minutes', c.target_minutes,
    'logged_minutes', coalesce(s.logged, 0)
  )), '[]'::jsonb)
  into v_commitment
  from public.circle_commitments c
  left join lateral (
    select coalesce(sum(e.hours * 60 + e.minutes), 0)::int as logged
    from public.entries e
    where e.user_id = c.user_id
      and e.language_id = c.language_id
      and e.date >= c.week_start
      and e.date <= current_date
  ) s on true
  where c.user_id = auth.uid()
    and c.week_start = v_week_start;

  v_details := jsonb_build_object(
    'session_count', v_sessions,
    'top_language', jsonb_build_object('name', v_top_name, 'color', v_top_color, 'minutes', v_top_mins),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'color', t.color, 'minutes', t.mins) order by t.mins desc)
      from (
        select l.name, l.color, sum(e.hours * 60 + e.minutes)::int as mins
        from public.entries e
        join public.languages l on l.user_id = e.user_id and l.id = e.language_id
        where e.user_id = auth.uid()
          and e.date >= v_week_start
          and e.date <= current_date
        group by l.name, l.color
      ) t
    ), '[]'::jsonb),
    'commitments', v_commitment
  );

  delete from public.activity_events
  where actor_id = auth.uid()
    and kind = 'circle_report'
    and occurred_on >= v_week_start
    and occurred_on <= current_date;

  insert into public.activity_events
    (actor_id, kind, minutes, language_name, language_color, session_count, occurred_on, details)
  values
    (auth.uid(), 'circle_report', v_mins, v_top_name, v_top_color, v_sessions, current_date, v_details);
end;
$$;

-- 6. Focus session completion --------------------------------------------------

-- Completes a focus session and auto-logs an entry for the elapsed duration.
-- If the session is stale, it logs the planned duration capped at elapsed.
create or replace function public.complete_focus_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session record;
  v_elapsed int;
  v_log_mins int;
  v_hours int;
  v_mins int;
begin
  select * into v_session
  from public.focus_sessions
  where id = p_session_id
    and user_id = auth.uid()
    and status = 'active'
  for update;

  if v_session is null then
    return;
  end if;

  v_elapsed := least(
    v_session.duration_minutes,
    greatest(0, extract(epoch from (now() - v_session.started_at))::int / 60)
  );
  v_log_mins := v_elapsed;

  if v_log_mins <= 0 then
    update public.focus_sessions set status = 'cancelled' where id = p_session_id;
    return;
  end if;

  v_hours := v_log_mins / 60;
  v_mins := v_log_mins % 60;

  insert into public.entries
    (user_id, date, language_id, type, hours, minutes, notes)
  values
    (
      auth.uid(),
      current_date,
      v_session.language_id,
      v_session.activity_type,
      v_hours,
      v_mins,
      'Focus session'
    );

  update public.focus_sessions
  set status = 'completed'
  where id = p_session_id;
end;
$$;

-- Expire any active focus sessions whose end time has passed. Can be run from
-- a cron or on client load via RPC.
create or replace function public.expire_focus_sessions()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session record;
begin
  for v_session in
    select id
    from public.focus_sessions
    where status = 'active'
      and ends_at <= now()
  loop
    perform public.complete_focus_session(v_session.id);
  end loop;
end;
$$;

-- 7. Updated new-entry trigger -------------------------------------------------

-- No longer emits per-session dispatches. Still emits milestones and blooms,
-- and now checks commitment progress.
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

  -- Milestones and blooms only happen for sessions logged today.
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

    for v_friend in
      select distinct e.user_id
      from public.entries e
      where e.user_id <> NEW.user_id
        and e.language_id = NEW.language_id
        and e.date = NEW.date
        and public.are_friends(NEW.user_id, e.user_id)
    loop
      insert into public.activity_events
        (actor_id, co_actor_id, kind, language_name, language_color, occurred_on)
      values
        (least(NEW.user_id, v_friend), greatest(NEW.user_id, v_friend), 'bloom', v_name, v_color, NEW.date)
      on conflict (actor_id, co_actor_id, language_name, occurred_on) where kind = 'bloom'
      do nothing;
    end loop;
  end if;

  -- Check commitment progress after the entry is counted.
  perform public.check_commitment_progress(
    NEW.user_id, NEW.language_id, v_name, v_color, NEW.date
  );

  return NEW;
end;
$$;

-- Make sure the trigger is attached (idempotent).
drop trigger if exists handle_new_entry_trigger on public.entries;
create trigger handle_new_entry_trigger
  after insert on public.entries
  for each row
  execute function public.handle_new_entry();

-- 8. Commitments with progress -----------------------------------------------

-- Returns the current week's commitments for self + friends, with logged
-- minutes counted up through today. Runs as SECURITY DEFINER so it can read
-- cross-user entries while the underlying tables remain private.
create or replace function public.circle_commitments_with_progress()
returns table (
  id             uuid,
  user_id        uuid,
  week_start     date,
  language_id    uuid,
  language_name  text,
  language_color text,
  target_minutes int,
  logged_minutes int,
  created_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start date := date_trunc('week', current_date)::date;
begin
  return query
    select
      c.id,
      c.user_id,
      c.week_start,
      c.language_id,
      c.language_name,
      c.language_color,
      c.target_minutes,
      coalesce((
        select sum(e.hours * 60 + e.minutes)::int
        from public.entries e
        where e.user_id = c.user_id
          and e.language_id = c.language_id
          and e.date >= c.week_start
          and e.date <= current_date
      ), 0) as logged_minutes,
      c.created_at
    from public.circle_commitments c
    where c.week_start = v_week_start
      and (
        c.user_id = auth.uid()
        or public.are_friends(auth.uid(), c.user_id)
      )
    order by c.created_at desc;
end;
$$;

-- 9. Leaderboard RPC -----------------------------------------------------------

-- Safe aggregate leaderboard for self + accepted friends. window = week | month | all_time.
create or replace function public.circle_leaderboard(p_window text)
returns table (
  user_id        uuid,
  username       text,
  display_name   text,
  minutes        int,
  current_streak int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_since date;
begin
  if p_window = 'week' then
    v_since := date_trunc('week', current_date)::date;
  elsif p_window = 'month' then
    v_since := date_trunc('month', current_date)::date;
  elsif p_window = 'all_time' then
    v_since := null;
  else
    raise exception 'invalid window: %', p_window;
  end if;

  return query
    select
      fr.friend_id as user_id,
      pr.username,
      pr.display_name,
      coalesce((
        select sum(e.hours * 60 + e.minutes)::int
        from public.entries e
        where e.user_id = fr.friend_id
          and (v_since is null or e.date >= v_since)
      ), 0) as minutes,
      public.current_streak_for(fr.friend_id) as current_streak
    from (
      select
        case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as friend_id
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    ) fr
    join public.profiles pr on pr.id = fr.friend_id

    union all

    select
      auth.uid() as user_id,
      p.username,
      p.display_name,
      coalesce((
        select sum(e.hours * 60 + e.minutes)::int
        from public.entries e
        where e.user_id = auth.uid()
          and (v_since is null or e.date >= v_since)
      ), 0) as minutes,
      public.current_streak_for(auth.uid()) as current_streak
    from public.profiles p
    where p.id = auth.uid()

    order by minutes desc, display_name;
end;
$$;

-- 9. RLS policies --------------------------------------------------------------

alter table public.circle_commitments enable row level security;
alter table public.focus_sessions enable row level security;

-- circle_commitments: visible to self and accepted friends.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='circle_commitments' and policyname='Commitments visible to self and friends') then
    create policy "Commitments visible to self and friends"
      on public.circle_commitments for select to authenticated
      using (
        user_id = auth.uid()
        or public.are_friends(auth.uid(), user_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='circle_commitments' and policyname='Users manage their own commitments') then
    create policy "Users manage their own commitments"
      on public.circle_commitments for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- focus_sessions: visible to self and accepted friends.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='focus_sessions' and policyname='Focus sessions visible to self and friends') then
    create policy "Focus sessions visible to self and friends"
      on public.focus_sessions for select to authenticated
      using (
        user_id = auth.uid()
        or public.are_friends(auth.uid(), user_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='focus_sessions' and policyname='Users manage their own focus sessions') then
    create policy "Users manage their own focus sessions"
      on public.focus_sessions for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- nudges: visible to sender and recipient only.
alter table public.nudges enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nudges' and policyname='Nudges visible to sender and recipient') then
    create policy "Nudges visible to sender and recipient"
      on public.nudges for select to authenticated
      using (sender_id = auth.uid() or recipient_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nudges' and policyname='Users send nudges to friends') then
    create policy "Users send nudges to friends"
      on public.nudges for insert to authenticated
      with check (
        sender_id = auth.uid()
        and public.are_friends(sender_id, recipient_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nudges' and policyname='Users delete their own nudges') then
    create policy "Users delete their own nudges"
      on public.nudges for delete to authenticated
      using (sender_id = auth.uid() or recipient_id = auth.uid());
  end if;
end $$;

-- 10. Realtime -----------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'circle_commitments'
  ) then
    alter publication supabase_realtime add table public.circle_commitments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'focus_sessions'
  ) then
    alter publication supabase_realtime add table public.focus_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nudges'
  ) then
    alter publication supabase_realtime add table public.nudges;
  end if;
end $$;

-- 11. Grants -------------------------------------------------------------------

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.circle_commitments_with_progress() to authenticated;
grant execute on function public.circle_leaderboard(text) to authenticated;
grant execute on function public.generate_circle_report() to authenticated;
grant execute on function public.complete_focus_session(uuid) to authenticated;
grant execute on function public.expire_focus_sessions() to authenticated;
grant select, insert, update, delete on public.circle_commitments to authenticated;
grant select, insert, update, delete on public.focus_sessions to authenticated;
grant select, insert, delete on public.nudges to authenticated;
