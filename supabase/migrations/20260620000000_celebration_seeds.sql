-- Celebrations slice: make the feed about *witnessed moments*, not a stat log.
--
-- Adds one new, well-bounded celebration kind:
--   * new_language — fires the first time a gardener ever logs a session in a
--     language ("planted a new language"). A rare, meaningful crossing, so it
--     earns a card; deduped to once per (gardener, language) for all time.
--
-- The anticipation sliver ("2 days to your 30-day streak"), the reactions-land-
-- back readout, and the freshness decay are all client-side and need no schema.

-- 1. Allow the new kind --------------------------------------------------------

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check
    check (kind in ('session', 'milestone', 'summary', 'bloom', 'commitment_progress', 'circle_report', 'new_language'));

-- One seed per language, ever — replanting the same language never re-announces.
create unique index if not exists activity_events_new_language_unique_idx
  on public.activity_events (actor_id, language_name)
  where kind = 'new_language';

-- 2. New-entry trigger: emit the seed on a gardener's first-ever session in a
--    language. Otherwise identical to the 20260617 revamp (milestones, blooms,
--    commitment progress) — create-or-replace swaps the whole body, so the
--    existing logic is carried forward verbatim with the new block added.

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

drop trigger if exists handle_new_entry_trigger on public.entries;
create trigger handle_new_entry_trigger
  after insert on public.entries
  for each row
  execute function public.handle_new_entry();
