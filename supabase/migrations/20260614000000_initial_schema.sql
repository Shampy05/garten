-- Base schema for Garten.
--
-- Creates the three public tables (languages, entries, user_settings), their
-- primary/foreign keys, indexes, and row-level security policies. The
-- statements are idempotent so this migration can be applied safely to both a
-- fresh Supabase project and an existing project that already has data.

-- 1. Tables

-- Per-user languages.
-- The `id` column is a client-generated slug (e.g. "spanish"), so the primary
-- key is composite (user_id, id).
create table if not exists public.languages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  color text not null,
  types text[] not null default '{}',
  prior_hours numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Study sessions / log entries.
-- `id` is client-generated, so the primary key is composite (user_id, id).
create table if not exists public.entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  language_id text not null,
  type text not null,
  hours numeric not null default 0,
  minutes numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user settings. One row per user.
create table if not exists public.user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_goal_hours numeric,
  native_language text,
  updated_at timestamptz not null default now()
);

-- 2. Primary keys (added separately because `add primary key if not exists`
--    is not valid SQL; this also lets us fail with a clear message if existing
--    data has duplicate (user_id, id) pairs.)

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'languages_pkey'
  ) then
    alter table public.languages add primary key (user_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entries_pkey'
  ) then
    alter table public.entries add primary key (user_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_settings_pkey'
  ) then
    alter table public.user_settings add primary key (user_id);
  end if;
end $$;

-- 3. Foreign key from entries -> languages, with cascade delete so removing a
--    language removes its sessions (matches current JS behaviour).
--    Added NOT VALID first, then validated, so existing orphan rows do not
--    block the migration.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entries_language_fk'
  ) then
    alter table public.entries
      add constraint entries_language_fk
      foreign key (user_id, language_id)
      references public.languages(user_id, id)
      on delete cascade
      not valid;

    alter table public.entries
      validate constraint entries_language_fk;
  end if;
end $$;

-- 4. Restrict activity types to the fixed set defined in src/lib/types.js.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_entry_type'
  ) then
    alter table public.entries
      add constraint chk_entry_type
      check (type in (
        'reading',
        'grammar',
        'vocabulary',
        'listening',
        'speaking',
        'writing',
        'pronunciation'
      ));
  end if;
end $$;

-- 5. Indexes for the queries the app actually runs.
create index if not exists idx_entries_user_date
  on public.entries(user_id, date desc);

create index if not exists idx_entries_user_language
  on public.entries(user_id, language_id);

create index if not exists idx_languages_user
  on public.languages(user_id);

-- 6. Row Level Security. The anon key is public by design, so the only thing
--    protecting one user's data from another is these policies.

alter table public.languages enable row level security;
alter table public.entries enable row level security;
alter table public.user_settings enable row level security;

-- 7. RLS policies: authenticated users can only see and mutate their own rows.
--    No access for anon.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'languages'
      and policyname = 'Users can manage their own languages'
  ) then
    create policy "Users can manage their own languages"
      on public.languages
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
      and tablename = 'entries'
      and policyname = 'Users can manage their own entries'
  ) then
    create policy "Users can manage their own entries"
      on public.entries
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
      and tablename = 'user_settings'
      and policyname = 'Users can manage their own settings'
  ) then
    create policy "Users can manage their own settings"
      on public.user_settings
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
