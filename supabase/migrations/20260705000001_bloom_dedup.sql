-- Bug: cross-pollination (bloom) events appeared multiple times for the
-- same (gardener pair, language) because the unique index was per-day.
-- Every day two friends both logged a session in the same language, a
-- new bloom fired, and the feed rendered the same meaningful moment
-- over and over — once yesterday, once five days ago, etc.
--
-- A cross-pollination is a meaningful shared moment, not a daily stat,
-- so the index should be per-(actor, co_actor, language) — the same
-- shape new_language already uses. Multiple blooms are still possible
-- across different languages (one per language pair, ever).
--
-- This migration:
--   1. Deduplicates existing rows — keeps the most recent bloom per
--      tuple, deletes the older ones (cascades to event_reactions).
--   2. Drops the per-day unique index.
--   3. Creates the per-tuple unique index.
--   4. Replaces handle_new_entry() so the trigger's ON CONFLICT target
--      matches the new index (was per-day, is now per-tuple).

-- 1. Dedupe: keep the most recent bloom per (actor, co_actor, language).
delete from public.activity_events ae
where ae.kind = 'bloom'
  and ae.id not in (
    select distinct on (actor_id, co_actor_id, language_name) id
    from public.activity_events
    where kind = 'bloom' and co_actor_id is not null
    order by actor_id, co_actor_id, language_name, occurred_on desc, id
  );

-- 2. Drop the per-day index.
drop index if exists public.activity_events_bloom_unique_idx;

-- 3. Create the per-tuple index.
create unique index if not exists activity_events_bloom_unique_idx
  on public.activity_events (actor_id, co_actor_id, language_name)
  where kind = 'bloom';

-- 4. Update handle_new_entry() to match the new index. Body is otherwise
--    identical to 20260620000000_celebration_seeds.sql — only the bloom
--    ON CONFLICT target changes.
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

  -- A planted seed: the first session this gardener has ever logged in this
  -- language. The trigger fires AFTER insert, so NEW is already in entries —
  -- exclude it when checking for any prior history.
  if not exists (
    select 1 from public.entries e
    where e.user_id = NEW.user_id
      and e.language_id = NEW.language_id
      and e.id <> NEW.id
  ) then
    insert into public.activity_events
      (actor_id, kind, language_name, language_color, occurred_on)
    values
      (NEW.user_id, 'new_language', v_name, v_color, NEW.date)
    on conflict (actor_id, language_name) where kind = 'new_language'
    do nothing;
  end if;

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
      on conflict (actor_id, co_actor_id, language_name) where kind = 'bloom'
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
