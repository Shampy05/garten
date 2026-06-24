// Curated list of languages a learner is likely to read in, each carrying its
// ISO 639-1 code. Garten's existing `languages.js` is names-only, but the book
// feature needs codes: the Google Books API filters and reports language by
// ISO 639-1 (fr, de, ja…), and the `books.language_code` column is constrained
// to this set. This file is the single source of truth — keep the codes in sync
// with the CHECK constraint in
// supabase/migrations/20260624000000_reading_library.sql (mirrors how
// src/lib/types.js pairs with chk_entry_type).

export const BOOK_LANGUAGES = [
  { name: 'Arabic', code: 'ar' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Czech', code: 'cs' },
  { name: 'Danish', code: 'da' },
  { name: 'Dutch', code: 'nl' },
  { name: 'English', code: 'en' },
  { name: 'Finnish', code: 'fi' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Greek', code: 'el' },
  { name: 'Hebrew', code: 'he' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Indonesian', code: 'id' },
  { name: 'Italian', code: 'it' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' },
  { name: 'Norwegian', code: 'no' },
  { name: 'Polish', code: 'pl' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Romanian', code: 'ro' },
  { name: 'Russian', code: 'ru' },
  { name: 'Spanish', code: 'es' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Turkish', code: 'tr' },
  { name: 'Ukrainian', code: 'uk' },
  { name: 'Vietnamese', code: 'vi' },
]

// Lowercased ISO 639-1 codes, for O(1) validity checks (filter, CHECK parity).
export const CODE_SET = new Set(BOOK_LANGUAGES.map((l) => l.code))

const CODE_TO_NAME = new Map(BOOK_LANGUAGES.map((l) => [l.code, l.name]))
const NAME_TO_CODE = new Map(BOOK_LANGUAGES.map((l) => [l.name.toLowerCase(), l.code]))

// Display name for a code, falling back to the raw code (upper-cased) so an
// unexpected language from the API still renders something sensible.
export function nameForCode(code) {
  if (!code) return ''
  return CODE_TO_NAME.get(code) ?? code.toUpperCase()
}

// Best-effort reverse lookup: map a Garten language name (e.g. "French") to its
// ISO 639-1 code so the search box can default to a language the user studies.
// Returns null when the name isn't in the curated reading set.
export function codeForName(name) {
  if (!name) return null
  return NAME_TO_CODE.get(name.toLowerCase()) ?? null
}

export function isValidCode(code) {
  return CODE_SET.has(code)
}
