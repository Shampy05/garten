-- Phase 3: playful interactions — water taps + weekly summary sharing.

-- 1. waters table: one tap per sender per recipient per day.
create table public.waters (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  watered_on  date not null default current_date,
  created_at  timestamptz not null default now(),
  constraint no_self_water    check (sender_id <> recipient_id),
  constraint unique_daily_water unique (sender_id, recipient_id, watered_on)
);

alter table public.waters enable row level security;

create policy "waters_select" on public.waters
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Only friends can water each other; RLS leverages the SECURITY DEFINER
-- are_friends() from phase2 to avoid recursion on the friendships table.
create policy "waters_insert" on public.waters
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and are_friends(auth.uid(), recipient_id)
  );

create policy "waters_delete" on public.waters
  for delete to authenticated
  using (sender_id = auth.uid());

grant select, insert, delete on public.waters to authenticated;

-- 2. share_weekly_summary(): posts a 'summary' dispatch for the calling user.
--    Reads from entries (owner-only table) inside SECURITY DEFINER so it is
--    the only path that can write a summary event — no INSERT policy on clients.
create or replace function public.share_weekly_summary()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', current_date)::date;
  v_mins       int;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'no profile';
  end if;

  select coalesce(sum(hours * 60 + minutes), 0)::int
  into v_mins
  from entries
  where user_id = auth.uid()
    and date >= v_week_start
    and date <= current_date;

  insert into activity_events (actor_id, kind, minutes, occurred_on)
  values (auth.uid(), 'summary', v_mins, current_date);
end;
$$;

grant execute on function public.share_weekly_summary() to authenticated;
