-- Backfill orphan reading_records for books that have no record row.
--
-- A small number of books were saved during a window where the saveBook flow
-- could partially fail: the books row was inserted (or upserted) but the
-- matching reading_records row never landed — the user closed the tab, the
-- network blipped, or the second write returned an error that the user
-- dismissed. The result was a book in the library table with no record in
-- reading_records, so the join in useBooks.loadBooks() returned
-- `record: null` and useShelves() filtered it out of every shelf
-- (status === 'reading' / 'want_to_read' / 'read' all fail on a null
-- record). The book was technically "saved" but invisible everywhere.
--
-- This migration backfills any such orphan with a default record:
--
--   * status: 'want_to_read' — the natural state for a book that was
--     just saved and never started
--   * target_language: from the book's language_code
--   * saved_at / added_to_queue_at: from the book's created_at
--   * current_page: 0
--   * everything else: null (we don't know the dates or page count)
--
-- Safety:
--
--   * INSERT only — never updates or deletes existing data
--   * ON CONFLICT (user_id, book_id) DO NOTHING — fully idempotent
--   * Defaults are conservative; the user can edit the book and the next
--     real save will overwrite the placeholder fields

insert into public.reading_records (
  user_id,
  book_id,
  target_language,
  status,
  current_page,
  total_pages,
  saved_at,
  started_at,
  finished_at,
  sort_index,
  added_to_queue_at
)
select
  b.user_id,
  b.id,
  b.language_code,
  'want_to_read' as status,
  0 as current_page,
  null as total_pages,
  b.created_at as saved_at,
  null as started_at,
  null as finished_at,
  null as sort_index,
  b.created_at as added_to_queue_at
from public.books b
where not exists (
  select 1
  from public.reading_records r
  where r.user_id = b.user_id
    and r.book_id = b.id
)
on conflict (user_id, book_id) do nothing;

-- Surface a count so the migration log shows what was recovered.
do $$
declare
  recovered int;
begin
  select count(*) into recovered
  from public.reading_records r
  where r.status = 'want_to_read'
    and r.added_to_queue_at = r.saved_at
    and r.current_page = 0
    and r.total_pages is null
    and r.started_at is null
    and r.finished_at is null;
  raise notice 'reading_records backfilled: % row(s) total (this includes
    any pre-existing records that match the placeholder shape)', recovered;
end $$;
