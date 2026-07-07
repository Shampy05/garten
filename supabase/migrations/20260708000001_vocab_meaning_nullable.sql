-- Word Garden: allow empty meanings when mining from a passage.
--
-- Mining plants a batch of new-word chips at once (see MineWordsModal); the
-- user adds meanings lazily during watering or via WordCard's inline edit.
-- The original schema enforced `meaning text not null` with length 1–500
-- (migration 20260707000000_word_garden.sql:28-30, 87-90) which made every
-- insert require a meaning — incompatible with the seed-first flow.
--
-- This relaxes both:
--   1. `meaning` becomes nullable (a NULL meaning signals "the user hasn't
--      filled this in yet"; mining writes null rather than a placeholder
--      string so the UI can show a real "add a meaning" prompt).
--   2. `chk_vocab_meaning` is replaced with `chk_vocab_meaning_optional`,
--      which only validates length when a meaning is supplied. NULLs pass.
--      An empty string also passes (btrim('') is '' which has char_length 0).
--      Backfill existing rows: NULL out any empty meanings so pre-relax rows
--      are consistent with the new convention.

alter table public.vocab_words
  alter column meaning drop not null;

alter table public.vocab_words
  drop constraint if exists chk_vocab_meaning;

alter table public.vocab_words
  add constraint chk_vocab_meaning_optional
    check (meaning is null or char_length(btrim(meaning)) between 1 and 500);

-- Anything stored as '' before today becomes NULL — keeps the convention
-- "null = not yet filled in" uniform across the table.
update public.vocab_words
   set meaning = null
 where meaning is not null
   and char_length(btrim(meaning)) = 0;