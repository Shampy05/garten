-- Reading progress: page-level tracking for currently-reading books.
--
-- Adds current/total page counts to reading_records and a per-user
-- reading_progress history table. Logging pages updates the book's current
-- page, can advance its status, and emits milestone celebrations into
-- activity_events (visible to friends in the Garden Circle).

-- 1. Extend reading_records with page counts ----------------------------------

alter table public.reading_records
  add column if not exists current_page int,
  add column if not exists total_pages int;

-- Total pages must be positive when set; current page must sit within bounds.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_reading_total_pages') then
    alter table public.reading_records
      add constraint chk_reading_total_pages
      check (total_pages is null or total_pages > 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_reading_current_page') then
    alter table public.reading_records
      add constraint chk_reading_current_page
      check (
        current_page is null
        or (current_page >= 0 and total_pages is null)
        or (current_page >= 0 and current_page <= total_pages)
      );
  end if;
end $$;

-- 2. Reading-progress history table -------------------------------------------

-- A row for each time the gardener logs pages. The from/to range is optional
-- metadata; pages_read is the delta that moves current_page forward.
create table if not exists public.reading_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  id           uuid not null default gen_random_uuid(),
  book_id      text not null,
  date         date not null default current_date,
  pages_read   int not null,
  from_page    int,
  to_page      int,
  minutes      int,
  notes        text,
  created_at   timestamptz not null default now(),
  constraint reading_progress_pkey primary key (user_id, id),
  constraint reading_progress_pages_read check (pages_read > 0),
  constraint reading_progress_minutes check (minutes is null or minutes >= 0)
);

-- Foreign key to books, composite and cascading.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reading_progress_book_fk') then
    alter table public.reading_progress
      add constraint reading_progress_book_fk
      foreign key (user_id, book_id)
      references public.books(user_id, id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_reading_progress_user_book
  on public.reading_progress(user_id, book_id, date desc);

create index if not exists idx_reading_progress_user_date
  on public.reading_progress(user_id, date desc);

-- 3. Row Level Security for reading_progress ----------------------------------

alter table public.reading_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reading_progress'
      and policyname = 'Users can manage their own reading progress'
  ) then
    create policy "Users can manage their own reading progress"
      on public.reading_progress
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 4. Allow a new celebration kind: reading milestones -------------------------

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check
    check (kind in ('session', 'milestone', 'bloom', 'commitment_progress', 'circle_report', 'new_language', 'reading_milestone'));

-- A given reading milestone for a book is announced at most once.
create unique index if not exists activity_events_reading_milestone_unique_idx
  on public.activity_events (actor_id, (details->>'book_id'), (details->>'milestone'))
  where kind = 'reading_milestone';

-- 5. SECURITY DEFINER helper: emit reading milestone celebrations -------------
--
-- Clients can't insert activity_events directly (RLS has no INSERT policy). The
-- app calls this after updating a book's current page so milestone crossings
-- are announced for self + friends.

create or replace function public.check_reading_milestone(
  p_user_id uuid,
  p_book_id text,
  p_old_page int,
  p_new_page int,
  p_total_pages int,
  p_book_title text,
  p_language_name text,
  p_language_color text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_milestone int;
  v_pct_old   numeric;
  v_pct_new   numeric;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  if p_total_pages is null or p_total_pages <= 0 then
    return;
  end if;

  v_pct_old := (p_old_page::numeric / p_total_pages) * 100;
  v_pct_new := (p_new_page::numeric / p_total_pages) * 100;

  foreach v_milestone in array array[25, 50, 75, 100] loop
    if v_pct_new >= v_milestone and v_pct_old < v_milestone then
      insert into public.activity_events
        (actor_id, kind, language_name, language_color, occurred_on, details)
      values
        (
          p_user_id,
          'reading_milestone',
          p_language_name,
          p_language_color,
          current_date,
          jsonb_build_object(
            'book_id', p_book_id,
            'book_title', p_book_title,
            'milestone', v_milestone,
            'pages_read', p_new_page,
            'total_pages', p_total_pages
          )
        )
      on conflict (actor_id, (details->>'book_id'), (details->>'milestone'))
        where kind = 'reading_milestone'
      do nothing;
    end if;
  end loop;
end;
$$;

grant execute on function public.check_reading_milestone(uuid, text, int, int, int, text, text, text) to authenticated;
