-- Word Garden: retire the "mine words from a book" feature and its
-- celebration signal. The passage-mining UI (MineWordsModal/BookPickerModal)
-- has been removed client-side; this is the matching down-migration for
-- 20260708000000_vocab_mined_event.sql.
--
-- Mirrors the circle_report precedent: legacy `vocab_mined` rows already in
-- activity_events are left in place (harmless — the client no longer
-- requests that kind), only the write path and the allowed-kind list change.

drop function if exists public.emit_vocab_mined(text, text, text, text, int);

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check
    check (kind in (
      'session', 'milestone', 'summary', 'bloom',
      'commitment_progress', 'circle_report', 'new_language',
      'reading_milestone', 'reading'
    ));
