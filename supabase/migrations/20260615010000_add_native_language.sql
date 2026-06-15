-- Native-language-aware proficiency targets (GAR-5): the learner's L1, used to
-- discount Fluency Horizon targets by language-family proximity to the target.
--
-- Safe for existing data: nullable column, NULL means "English baseline" — the
-- exact behaviour every user had before, so nothing changes until they set it.

alter table public.user_settings
  add column if not exists native_language text;
