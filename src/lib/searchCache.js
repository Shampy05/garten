// Recent-search history for the Library search bar. Local-only: nothing here
// touches Supabase. Kept in localStorage so the suggestions survive reloads
// but vanish on a different device, which is the privacy posture we want for
// a query log.
//
// Each user gets their own namespace (`garten_search_recent_<uid>`), capped at
// `MAX_RECENT` entries, MRU-ordered. Whitespace is trimmed; an empty query
// is a no-op so accidental submits don't pollute the list.

const MAX_RECENT = 5
const PREFIX = 'garten_search_recent_'

function key(userId) {
  return `${PREFIX}${userId || 'anon'}`
}

function readList(userId) {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : []
  } catch (e) {
    return []
  }
}

function writeList(userId, list) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key(userId), JSON.stringify(list))
  } catch (e) {
    // Quota exceeded or private mode — fail quietly. Suggestions are an
    // additive nicety, not core functionality.
  }
}

export function getRecentSearches(userId) {
  return readList(userId)
}

export function pushRecentSearch(userId, query) {
  const q = (query || '').trim()
  if (!q) return readList(userId)
  const list = readList(userId)
  // MRU: drop any existing entry for the same query, then prepend.
  const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT)
  writeList(userId, next)
  return next
}

export function clearRecentSearches(userId) {
  writeList(userId, [])
}
