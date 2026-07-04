-- Personalisation fields.
--
-- Three nullable columns across two tables, all covered by the existing
-- per-user RLS on their parent tables, so no policy work is needed:
--
--   * languages.nickname        — a user-chosen display alias. The canonical
--     language name (e.g. "Spanish") stays the source of truth for ids,
--     data joins, and the autocomplete add flow; the nickname is purely
--     cosmetic and is read via useLanguageLookup.nameFor() =
--     nickname?.trim() || name. No data path ever filters or joins on it.
--
--   * languages.first_bloom_at  — when this language first crossed into the
--     `bloom` growth stage (50 logged hours, see STAGE_HOURS in
--     src/lib/avatar.js). Set once from App.vue when the transition is
--     detected by detectMilestone, and used to gate the "Your Spanish just
--     bloomed" one-time toast. Nullable so the trigger is "null → now()",
--     which is also the natural "never bloomed" signal.
--
--   * profiles.garden_name      — a user-chosen name for their garden.
--     Shown in the header subtitle (replacing the static brand tagline when
--     set) and as the heading in the GardenerProfile modal. Falls back to
--     the static copy when null.
--
-- All three are TEXT / TIMESTAMPTZ, nullable, with no defaults. RLS is
-- inherited from the row-level policies on languages and profiles.

alter table public.languages
  add column if not exists nickname text;

alter table public.languages
  add column if not exists first_bloom_at timestamptz;

alter table public.profiles
  add column if not exists garden_name text;
