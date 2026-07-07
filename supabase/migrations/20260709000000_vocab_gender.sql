-- Word Garden: optional grammatical gender per word.
--
-- Many languages mark nouns for gender (der/die/das, le/la, ...) and
-- remembering it is core to knowing the noun, so the capture/edit forms let
-- the gardener tag one. `gender` is nullable — most words won't have one set:
-- verbs/adjectives don't take a gender at all, the word's language may have
-- no grammatical gender, or the gardener simply hasn't filled it in yet.
--
-- The four values cover every shape src/lib/grammaticalGender.js produces
-- across the app's tracked languages, including Scandinavian/Dutch/Frisian-
-- style languages where the old masculine/feminine distinction merged into
-- one "common" gender opposite neuter (no masculine or feminine as such).
-- The client is the source of truth for *which* languages get *which*
-- subset of these — this CHECK only bounds the value, it doesn't validate
-- the value against the word's language.

alter table public.vocab_words
  add column if not exists gender text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_gender') then
    alter table public.vocab_words
      add constraint chk_vocab_gender
      check (gender is null or gender in ('masculine', 'feminine', 'neuter', 'common'));
  end if;
end $$;
