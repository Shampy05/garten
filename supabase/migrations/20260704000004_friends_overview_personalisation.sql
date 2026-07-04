-- Friends-list bloom colour sync.
--
-- The circle_leaderboard RPC was extended in
-- 20260704000001_leaderboard_avatar_variant.sql to return
-- profiles.avatar_variant, so the leaderboard rows render the friend's
-- chosen bloom colour. friends_overview — which feeds the "Your friends"
-- list, the friend-search results, and the profile modal's friend-mode
-- base row — never picked that column up, so the friends list's
-- BloomAvatar always fell back to the id-hashed default and the same
-- gardener showed up in two colours depending on which view you opened.
--
-- Adding avatar_variant + garden_name to the return shape is additive and
-- safe: callers (useSocial.js) just read extra fields off the row, and the
-- view layer (FriendsList.vue) now passes the variant to the avatar. The
-- garden_name lands on the same row so the friend profile modal can
-- surface it without a second fetch.
--
-- RETURNS TABLE changes require DROP+CREATE — `create or replace function`
-- rejects the return-shape change (PostgreSQL 42P13) — so the function is
-- dropped and recreated. Security, language, and grants stay identical.

drop function if exists public.friends_overview();

create function public.friends_overview()
returns table (
  friendship_id     uuid,
  friend_id         uuid,
  username          text,
  display_name      text,
  avatar_variant    smallint,
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
