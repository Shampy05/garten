-- Bloom companion: a chosen critter perched on the avatar, mirroring the
-- avatar_variant (bloom colour) pattern exactly.
--
--   * profiles.avatar_companion — index into COMPANIONS (src/lib/avatar.js:
--     0 ladybird, 1 bee, 2 butterfly, 3 snail). NULL = no companion. Nullable,
--     opt-in, inherits profiles' existing RLS — no new policies needed, same
--     as 20260703000000_profile_personalization.sql.
--
-- The three RPCs that already surface avatar_variant to other gardeners
-- (friends_overview, circle_leaderboard, search_users) are extended the same
-- way here so the companion shows up everywhere the bloom colour does. Each
-- RETURNS TABLE change requires DROP+CREATE (PostgreSQL 42P13); security,
-- language, and grants are preserved from their prior migrations.

alter table public.profiles
  add column if not exists avatar_companion smallint
    constraint profiles_avatar_companion_range check (avatar_companion is null or avatar_companion between 0 and 3);

drop function if exists public.friends_overview();

create function public.friends_overview()
returns table (
  friendship_id     uuid,
  friend_id         uuid,
  username          text,
  display_name      text,
  avatar_variant    smallint,
  avatar_companion  smallint,
  garden_name       text,
  current_streak    int,
  last_active       date,
  minutes_this_week int,
  active_languages  jsonb
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
    pr.avatar_variant,
    pr.avatar_companion,
    pr.garden_name,
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

grant execute on function public.friends_overview() to authenticated;

drop function if exists public.circle_leaderboard(text);

create function public.circle_leaderboard(p_window text)
returns table (
  user_id          uuid,
  username         text,
  display_name     text,
  avatar_variant   smallint,
  avatar_companion smallint,
  minutes          int,
  current_streak   int
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
      pr.avatar_variant,
      pr.avatar_companion,
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
      p.avatar_variant,
      p.avatar_companion,
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

grant execute on function public.circle_leaderboard(text) to authenticated;

drop function if exists public.search_users(text);

create function public.search_users(q text)
returns table (id uuid, username text, display_name text, avatar_variant smallint, avatar_companion smallint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.display_name, p.avatar_variant, p.avatar_companion
  from public.profiles p
  where p.discoverable = true
    and (
      p.username ilike q || '%'
      or p.display_name ilike '%' || q || '%'
    )
  order by p.username
  limit 10;
$$;

grant execute on function public.search_users(text) to authenticated;
