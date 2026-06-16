-- Phase 6: backfill older weekly harvest dispatches so they show session count
-- and the per-language progress bar instead of "0 sessions" with no breakdown.

do $$
declare
  rec record;
  v_week_start date;
  v_sessions   int;
  v_top_name   text;
  v_top_color  text;
  v_details    jsonb;
begin
  for rec in
    select id, actor_id, occurred_on
    from public.activity_events
    where kind = 'summary'
      and (session_count is null or details is null)
  loop
    v_week_start := date_trunc('week', rec.occurred_on)::date;

    select count(*)::int
    into v_sessions
    from public.entries
    where user_id = rec.actor_id
      and date >= v_week_start
      and date <= rec.occurred_on;

    select l.name, l.color
    into v_top_name, v_top_color
    from public.entries e
    join public.languages l on l.user_id = e.user_id and l.id = e.language_id
    where e.user_id = rec.actor_id
      and e.date >= v_week_start
      and e.date <= rec.occurred_on
    group by l.name, l.color
    order by sum(e.hours * 60 + e.minutes) desc
    limit 1;

    v_details := jsonb_build_object(
      'session_count', v_sessions,
      'top_language', jsonb_build_object(
        'name', v_top_name,
        'color', v_top_color,
        'minutes', null
      ),
      'languages', coalesce((
        select jsonb_agg(jsonb_build_object('name', t.name, 'color', t.color, 'minutes', t.mins) order by t.mins desc)
        from (
          select l.name, l.color, sum(e.hours * 60 + e.minutes)::int as mins
          from public.entries e
          join public.languages l on l.user_id = e.user_id and l.id = e.language_id
          where e.user_id = rec.actor_id
            and e.date >= v_week_start
            and e.date <= rec.occurred_on
          group by l.name, l.color
        ) t
      ), '[]'::jsonb)
    );

    update public.activity_events
    set session_count = v_sessions,
        language_name = coalesce(language_name, v_top_name),
        language_color = coalesce(language_color, v_top_color),
        details = v_details
    where id = rec.id;
  end loop;
end $$;
