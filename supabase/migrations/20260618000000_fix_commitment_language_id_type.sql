-- Fix: language_id is a text slug (e.g. "spanish", "mandarin-chinese"), generated
-- client-side as language.name.toLowerCase().replace(/\s+/g, '-'). The Garden Circle
-- migration mistakenly typed it as uuid in two functions:
--   * check_commitment_progress(p_language_id uuid)  -> called by handle_new_entry()
--     on EVERY entry insert, so 'spanish'::uuid threw and blocked all session logging.
--   * circle_commitments_with_progress() returns ... language_id uuid -> runtime type
--     mismatch, so commitments never loaded.
-- Both are corrected to text to match public.languages.id / public.entries.language_id.

-- 1. Commitment progress check (text language id) ------------------------------
create or replace function public.check_commitment_progress(
  p_user_id uuid,
  p_language_id text,
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

    if v_ratio >= 1 then
      v_milestone := 100;
    elsif v_ratio >= 0.5 then
      v_milestone := 50;
    else
      continue;
    end if;

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

-- 2. Commitments with progress (text language id) -----------------------------
-- Drop first: changing a RETURNS TABLE column type requires a drop/recreate.
drop function if exists public.circle_commitments_with_progress();

create or replace function public.circle_commitments_with_progress()
returns table (
  id             uuid,
  user_id        uuid,
  week_start     date,
  language_id    text,
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

grant execute on function public.circle_commitments_with_progress() to authenticated;
