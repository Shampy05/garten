-- Reading Library — find books in a target language and track reading them.
--
-- Two per-user tables joined 1:1: `books` holds the externally-sourced metadata
-- (one row per saved Google Books volume) and `reading_records` holds the
-- user's reading data (status, difficulty, notes, dates). The split mirrors the
-- spec's separation of "externally-sourced book data" from "user-generated
-- reading data". Statements are idempotent so this can be applied safely to a
-- fresh or existing project, matching the conventions in
-- 20260614000000_initial_schema.sql.

-- 1. Tables

-- Books the user has saved from search results. `id` is a client-generated
-- UUID, so the primary key is composite (user_id, id). `external_id` is the
-- Google Books volume id.
create table if not exists public.books (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  external_id text not null,
  title text not null,
  author text,
  cover_url text,
  description text,
  language_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reading record for a saved book. Strictly 1:1 with books: the primary key is
-- (user_id, book_id), which on its own enforces "one book → one reading record".
create table if not exists public.reading_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  target_language text not null,
  status text not null,
  rating numeric,
  difficulty text,
  notes text,
  saved_at date not null default current_date,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Primary keys (added separately; `add primary key if not exists` is invalid).

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_pkey') then
    alter table public.books add primary key (user_id, id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reading_records_pkey') then
    alter table public.reading_records add primary key (user_id, book_id);
  end if;
end $$;

-- 3. A book's external id is unique per user: saving the same book twice updates
--    the existing record rather than creating a duplicate (NFR / no-duplicates).

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_user_external_uniq') then
    alter table public.books
      add constraint books_user_external_uniq unique (user_id, external_id);
  end if;
end $$;

-- 4. Foreign key reading_records -> books, cascade so removing a book removes
--    its reading record ("reading record cannot exist without a saved book").
--    NOT VALID then VALIDATE so any pre-existing rows do not block the migration.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reading_records_book_fk') then
    alter table public.reading_records
      add constraint reading_records_book_fk
      foreign key (user_id, book_id)
      references public.books(user_id, id)
      on delete cascade
      not valid;

    alter table public.reading_records
      validate constraint reading_records_book_fk;
  end if;
end $$;

-- 5. Constrain status and difficulty to their fixed value sets.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_reading_status') then
    alter table public.reading_records
      add constraint chk_reading_status
      check (status in ('want_to_read', 'reading', 'read'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_reading_difficulty') then
    alter table public.reading_records
      add constraint chk_reading_difficulty
      check (difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced'));
  end if;
end $$;

-- 5b. Rating is optional, 0–5 stars in 0.5 steps.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_reading_rating') then
    alter table public.reading_records
      add constraint chk_reading_rating
      check (rating is null or rating in (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5));
  end if;
end $$;

-- 6. Constrain language codes to the curated ISO 639-1 set. Keep this list in
--    sync with src/lib/bookLanguages.js (mirrors how chk_entry_type pairs with
--    src/lib/types.js). `target_language` is also a 639-1 code from the same set.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_book_language_code') then
    alter table public.books
      add constraint chk_book_language_code
      check (language_code in (
        'ar','zh','cs','da','nl','en','fi','fr','de','el','he','hi','id','it',
        'ja','ko','no','pl','pt','ro','ru','es','sv','tr','uk','vi'
      ));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_target_language_code') then
    alter table public.reading_records
      add constraint chk_target_language_code
      check (target_language in (
        'ar','zh','cs','da','nl','en','fi','fr','de','el','he','hi','id','it',
        'ja','ko','no','pl','pt','ro','ru','es','sv','tr','uk','vi'
      ));
  end if;
end $$;

-- 7. Indexes for the queries the app runs.
create index if not exists idx_books_user
  on public.books(user_id);

create index if not exists idx_books_user_language
  on public.books(user_id, language_code);

create index if not exists idx_reading_records_user
  on public.reading_records(user_id);

-- 8. Row Level Security — authenticated users see and mutate only their own rows.

alter table public.books enable row level security;
alter table public.reading_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'books'
      and policyname = 'Users can manage their own books'
  ) then
    create policy "Users can manage their own books"
      on public.books
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reading_records'
      and policyname = 'Users can manage their own reading records'
  ) then
    create policy "Users can manage their own reading records"
      on public.reading_records
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
