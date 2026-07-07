-- Word Garden — spaced-repetition vocabulary.
--
-- One per-user table: each row is a word/phrase the user planted, carrying its
-- own SRS state (Leitner stage + due date — see src/lib/srs.js). No separate
-- review-history table in v1: per-word stage/lapses/review_count/last_reviewed_at
-- cover every current surface, and a history table would add one insert per
-- grade against the free-tier budget with nothing reading it yet. If a
-- review-heatmap/retention slice lands later, add `vocab_reviews` then — these
-- columns don't preclude it.
--
-- `language_id` is the client-generated languages slug (e.g. 'spanish'),
-- composite-FK'd exactly like entries.language_id — deleting a language
-- deletes its words, consistent with deleteLanguage() wiping entries.
--
-- `source_book_id` is a SOFT reference to books.id, deliberately without an
-- FK: cascade would delete vocabulary when a book is removed (wrong — the word
-- was still learned), and a composite set-null can't null just the book column
-- without PG15's column-list form. The client joins in memory and simply shows
-- no source label when the book is gone.
--
-- Statements are idempotent, matching 20260624000000_reading_library.sql.

create table if not exists public.vocab_words (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  language_id text not null,
  term text not null,
  meaning text not null,
  note text,
  source_book_id text,
  stage int not null default 0,
  due_date date not null default current_date,
  lapses int not null default 0,
  review_count int not null default 0,
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary key (added separately; `add primary key if not exists` is invalid).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vocab_words_pkey') then
    alter table public.vocab_words add primary key (user_id, id);
  end if;
end $$;

-- FK to the user's languages, cascade on language removal (mirrors
-- entries_language_fk). NOT VALID then VALIDATE so pre-existing rows never
-- block the migration.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vocab_words_language_fk') then
    alter table public.vocab_words
      add constraint vocab_words_language_fk
      foreign key (user_id, language_id)
      references public.languages(user_id, id)
      on delete cascade
      not valid;

    alter table public.vocab_words
      validate constraint vocab_words_language_fk;
  end if;
end $$;

-- Value constraints. Stage bounds pair with SRS_INTERVALS in src/lib/srs.js
-- (7 rungs, 0–6) — keep them in sync.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_stage') then
    alter table public.vocab_words
      add constraint chk_vocab_stage check (stage between 0 and 6);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_term') then
    alter table public.vocab_words
      add constraint chk_vocab_term
      check (char_length(btrim(term)) between 1 and 200);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_meaning') then
    alter table public.vocab_words
      add constraint chk_vocab_meaning
      check (char_length(btrim(meaning)) between 1 and 500);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vocab_counts') then
    alter table public.vocab_words
      add constraint chk_vocab_counts
      check (lapses >= 0 and review_count >= 0);
  end if;
end $$;

-- Indexes for the queries the app runs (full per-user load; due-count scans).
create index if not exists idx_vocab_user
  on public.vocab_words(user_id);

create index if not exists idx_vocab_user_due
  on public.vocab_words(user_id, due_date);

create index if not exists idx_vocab_user_language
  on public.vocab_words(user_id, language_id);

-- Row Level Security — authenticated users see and mutate only their own rows.
alter table public.vocab_words enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vocab_words'
      and policyname = 'Users can manage their own vocab words'
  ) then
    create policy "Users can manage their own vocab words"
      on public.vocab_words
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
