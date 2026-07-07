-- Word Garden: optional part-of-speech tag per word.
--
-- `word_type` is nullable — most existing words predate this column, and a
-- gardener may not bother tagging every word. Unlike `gender`
-- (20260709000000_vocab_gender.sql), this needs no per-language mapping:
-- every language has nouns/verbs/adjectives, so the set is fixed and
-- universal (src/lib/wordType.js is the single source of truth for it).
--
-- The client also uses this to decide whether the gender pill makes sense
-- for a word (gender only applies to nouns) — see `isNounlike` in
-- src/lib/wordType.js. That's a client-side UI gate, not enforced here.

alter table public.vocab_words
  add column if not exists word_type text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_word_type') then
    alter table public.vocab_words
      add constraint chk_vocab_word_type
      check (word_type is null or word_type in ('noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'));
  end if;
end $$;
