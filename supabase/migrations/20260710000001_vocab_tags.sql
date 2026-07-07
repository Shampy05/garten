-- Word Garden: freeform tags for themed collections ("kitchen", "trip to
-- Berlin") that cut across languages, distinct from the language filter.
--
-- A plain text array, mirroring the existing `languages.types` column
-- (20260614000000_initial_schema.sql) rather than a normalized join table —
-- same shape of problem (a small set of labels per row), same solution.
-- Freeform means no CHECK against a fixed vocabulary (unlike word_type or
-- gender); only a sanity cap on how many tags one word can carry.

alter table public.vocab_words
  add column if not exists tags text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_tags_count') then
    alter table public.vocab_words
      add constraint chk_vocab_tags_count
      check (array_length(tags, 1) is null or array_length(tags, 1) <= 8);
  end if;
end $$;

-- Words are commonly browsed/reviewed "by tag" (mirrors idx_vocab_user_language).
create index if not exists idx_vocab_user_tags
  on public.vocab_words using gin (tags);
