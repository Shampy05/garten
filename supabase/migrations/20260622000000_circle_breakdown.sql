-- Circle breakdown: per-language / per-activity texture for the leaderboard, so
-- gardeners can compare *what* they're growing (Spanish reading vs Japanese
-- listening) — not just total hours. Safe aggregate for self + accepted friends.

create or replace function public.circle_breakdown(p_window text)
returns table (
  user_id        uuid,
  language_name  text,
  language_color text,
  activity_type  text,
  minutes        int
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
      e.user_id,
      l.name  as language_name,
      l.color as language_color,
      e.type  as activity_type,
      sum(e.hours * 60 + e.minutes)::int as minutes
    from public.entries e
    join public.languages l on l.user_id = e.user_id and l.id = e.language_id
    where (v_since is null or e.date >= v_since)
      and (e.user_id = auth.uid() or public.are_friends(auth.uid(), e.user_id))
    group by e.user_id, l.name, l.color, e.type;
end;
$$;

grant execute on function public.circle_breakdown(text) to authenticated;
