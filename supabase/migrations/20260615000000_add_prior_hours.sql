-- Fluency Horizon: per-language "starting point" hours credited from prior
-- experience before the user began tracking in Garten.
--
-- Safe for existing data: nullable-free column with a default of 0, so every
-- existing language row is backfilled to 0 and behaves exactly as before.

alter table public.languages
  add column if not exists prior_hours numeric not null default 0;
