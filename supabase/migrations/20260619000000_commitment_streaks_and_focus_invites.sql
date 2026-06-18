-- Two "deepen the circle" features:
--   1. Commitment streaks — how many consecutive weeks a gardener has met at
--      least one weekly commitment. Computed for self + accepted friends via a
--      SECURITY DEFINER RPC (so it can read friends' entries safely).
--   2. Targeted focus invites — a 'invite' nudge that points at a focus_session,
--      so you can invite specific friends to study with you.

-- 1. Commitment streaks --------------------------------------------------------

-- Did a user meet at least one commitment in the given week?
create or replace function public.commitment_week_met(p_user_id uuid, p_week_start date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_commitments c
    where c.user_id = p_user_id
      and c.week_start = p_week_start
      and coalesce((
        select sum(e.hours * 60 + e.minutes)
        from public.entries e
        where e.user_id = c.user_id
          and e.language_id = c.language_id
          and e.date >= c.week_start
          and e.date < c.week_start + 7
      ), 0) >= c.target_minutes
  );
$$;

-- Consecutive met-weeks for self + friends. The in-progress current week only
-- counts once it's already met, so an unfinished week never breaks the streak.
create or replace function public.circle_commitment_streaks()
returns table (user_id uuid, weeks int)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid;
  v_week  date;
  v_count int;
begin
  for v_uid in
    select auth.uid()
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  loop
    v_week := date_trunc('week', current_date)::date;
    -- Skip the current week if it isn't met yet (still in progress).
    if not public.commitment_week_met(v_uid, v_week) then
      v_week := v_week - 7;
    end if;

    v_count := 0;
    while public.commitment_week_met(v_uid, v_week) and v_count < 104 loop
      v_count := v_count + 1;
      v_week := v_week - 7;
    end loop;

    user_id := v_uid;
    weeks := v_count;
    return next;
  end loop;
end;
$$;

-- 2. Targeted focus invites ----------------------------------------------------

-- Allow 'invite' nudges and link them to the focus session being shared.
alter table public.nudges
  drop constraint if exists nudges_kind_check;

alter table public.nudges
  add constraint nudges_kind_check check (kind in ('cheer', 'nudge', 'invite'));

alter table public.nudges
  add column if not exists focus_session_id uuid
    references public.focus_sessions(id) on delete cascade;

-- 3. Grants --------------------------------------------------------------------

grant execute on function public.commitment_week_met(uuid, date) to authenticated;
grant execute on function public.circle_commitment_streaks() to authenticated;
