-- Surface each gardener's chosen bloom colour in the leaderboard.
--
-- The circle_leaderboard RPC returned identity + minutes + streak, but not
-- avatar_variant. The leaderboard UI renders BloomAvatar rows for every
-- gardener, and without avatar_variant it always fell back to the
-- deterministic id-hashed default — so a friend's chosen colour only ever
-- showed in the GardenerProfile modal. The FriendsList, FriendSearch, and
-- RequestsInbox rows had the same gap.
--
-- Adding avatar_variant to the return shape is additive and safe:
--   * the column already exists on profiles (smallint, NULL OK, RLS unchanged),
--   * callers that don't read it ignore the extra field,
--   * SECURITY DEFINER + SET search_path is preserved, so the existing
--     grants to authenticated still cover the new signature.
--
-- Re-issuing the function with create or replace keeps the migration
-- idempotent against a project where the previous version has already
-- been applied. The DROP-then-CREATE dance is needed because adding a
-- column to a RETURNS TABLE definition is a return-type change, which
-- CREATE OR REPLACE rejects (it can only replace a function with the
-- same signature). DROP FUNCTION is restricted to the exact signature
-- and the function is recreated with its existing grants.

drop function if exists public.circle_leaderboard(text);

create function public.circle_leaderboard(p_window text)
returns table (
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_variant smallint,
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
      pr.avatar_variant,
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
