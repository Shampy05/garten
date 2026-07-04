// Per-user localStorage cache, shared by useStorage and useBooks. Reads return
// null when the entry is missing, when it's been TTL'd out, or — now — when
// it was written by an older version of the app and the version field doesn't
// match. Writes stamp the current version so a future bump invalidates every
// old entry in one go.
//
// Why the version field exists: the save race in useBooks (fixed in
// 5d6b8c3) could leave a book in the Supabase `books` table with no entry in
// the local cache, because the race overwrote the in-memory list before the
// new state was persisted. The 30s TTL would normally self-correct, but a
// user who keeps mutating their library (saving, page-logging, editing) will
// keep re-stamping the stale cache and never see the book until they happen
// to wait 30s without any mutation. Bumping CACHE_VERSION forces every
// affected user to re-fetch from Supabase on their next page load — the
// books that were "saved but invisible" reappear.
//
// Bump this constant any time the cached shape changes in a way that older
// payloads would render incorrectly. The data lives in garten_data_<uid>
// (useStorage) and garten_data_books_<uid> (useBooks), so a mismatch on
// either side blanks both, which is the safe default.

const TTL = 30_000
const CACHE_VERSION = 2

function key(userId) {
  return `garten_data_${userId}`
}

export function getCached(userId) {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const { data, ts, v } = JSON.parse(raw)
    // Treat any pre-versioned cache as legacy and ignore it. Same goes for
    // a cache that was stamped by a newer version than this build knows
    // about (forward-compat: a downgrade should still get a clean fetch
    // rather than crash on a shape the old code doesn't understand).
    if (v !== CACHE_VERSION) {
      localStorage.removeItem(key(userId))
      return null
    }
    if (Date.now() - ts > TTL) {
      localStorage.removeItem(key(userId))
      return null
    }
    return data
  } catch {
    return null
  }
}

export function setCache(userId, data) {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ data, ts: Date.now(), v: CACHE_VERSION }))
  } catch {
  }
}

// Exposed for the useBooks cache key, which lives at garten_data_books_<uid>
// to avoid clobbering useStorage's main entry. Same version + TTL rules —
// bumping CACHE_VERSION invalidates both. We could split this into two
// constants, but a coordinated bump is the right call when the change is
// a shape migration, not a per-store tweak.
export const CACHE_VERSION_TAG = CACHE_VERSION
