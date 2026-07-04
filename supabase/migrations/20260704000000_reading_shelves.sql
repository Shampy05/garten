-- Reading shelves: a manual sort order for the "Up next" queue plus an
-- explicit "added to queue" timestamp that survives status flips.
--
-- Both columns are additive and nullable-by-default (sort_index) / defaulted
-- (added_to_queue_at), so existing rows are never broken and the migration
-- is safe to run against a populated database. RLS is unchanged — the existing
-- per-user policies on reading_records already cover these columns because
-- they apply to whole-row reads/writes.
--
--   * sort_index         — integer, nullable. NULL means "no manual order";
--                          sort by added_to_queue_at desc in that case.
--                          The composable uses a sparse integer scheme so a
--                          single reorder writes two adjacent rows, not the
--                          whole queue.
--
--   * added_to_queue_at  — timestamptz, default now(). For existing
--                          want_to_read rows, backfilled from created_at so
--                          the first render's order is stable and intuitive
--                          ("oldest first" → the longest-queued book sits at
--                          the top of Up next). Reading and read rows don't
--                          drive queue order, so they're left at the default.

alter table public.reading_records
  add column if not exists sort_index integer,
  add column if not exists added_to_queue_at timestamptz not null default now();

-- Backfill: only want_to_read rows need an accurate "when did this enter the
-- queue" timestamp. Reading and read rows sort by their own status-specific
-- fields (started_at, finished_at) and never use added_to_queue_at.
update public.reading_records
  set added_to_queue_at = created_at
  where status = 'want_to_read';

create index if not exists idx_reading_records_user_sort
  on public.reading_records(user_id, sort_index)
  where sort_index is not null;
