-- Add optional 0–5 star rating (0.5-step) to reading records.

alter table public.reading_records
  add column if not exists rating numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_reading_rating') then
    alter table public.reading_records
      add constraint chk_reading_rating
      check (rating is null or rating in (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5));
  end if;
end $$;
