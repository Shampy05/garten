-- Expand the avatar_variant CHECK range to fit the new blooms.
--
-- The profile personalization migration (20260703000000) capped
-- avatar_variant at 0..5, matching the original six BLOOMS in
-- src/lib/avatar.js. We just added three more (sage, plum, cream) at
-- indices 6, 7, 8, so the existing constraint would reject any save
-- that picks one of them. Lifting the upper bound to 8 keeps the
-- mapping 1:1 between BLOOMS index and DB value, leaves a little
-- headroom for future additions, and stays a smallint-safe range.
--
-- Idempotent: drop-if-exists the old constraint, then add the new one
-- with the same name. RLS is untouched — the column is still on
-- profiles, the existing "own row only" policy covers writes.

alter table public.profiles
  drop constraint if exists profiles_avatar_variant_range;

alter table public.profiles
  add constraint profiles_avatar_variant_range
  check (avatar_variant is null or avatar_variant between 0 and 8);
