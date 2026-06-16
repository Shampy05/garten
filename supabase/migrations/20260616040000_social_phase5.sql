-- Phase 5: make water taps visible to recipients.

-- 1. Speed up "who watered me today" lookups.
create index if not exists waters_recipient_idx
  on public.waters (recipient_id, watered_on);

-- 2. Realtime: broadcast water taps so recipients see them live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waters'
  ) then
    alter publication supabase_realtime add table public.waters;
  end if;
end $$;
