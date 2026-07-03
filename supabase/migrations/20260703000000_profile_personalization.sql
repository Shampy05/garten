-- Profile personalization: a short bio and a chosen bloom colour.
--
-- Both are opt-in cosmetics on the existing opt-in `profiles` row, so they
-- inherit its RLS unchanged (visible to self + accepted friends; writable only
-- by the owner) and its existing table grants — no new policies or grants
-- needed. Adding nullable columns is a safe, backfill-free change; existing
-- `select *` reads in useSocial pick them up automatically.
--
--   * bio            — a 160-char self-description, shown on the gardener
--                      profile. NULL / empty = no bio.
--   * avatar_variant — index into the BloomAvatar palette (BLOOMS in
--                      src/lib/avatar.js, 6 entries → 0..5) letting a gardener
--                      pick their bloom colour instead of the id-hash default.
--                      NULL = keep the deterministic hashed colour.

alter table public.profiles
  add column if not exists bio text
    constraint profiles_bio_length check (bio is null or char_length(bio) <= 160),
  add column if not exists avatar_variant smallint
    constraint profiles_avatar_variant_range check (avatar_variant is null or avatar_variant between 0 and 5);
