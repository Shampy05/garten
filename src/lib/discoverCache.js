// Per-row cache for the Discover section. Deliberately its own module rather
// than an extension of cache.js (whose 30s TTL is wrong for this — Discover
// rows should survive a whole day of reloads to respect the keyless Google
// Books quota) or searchCache.js (an MRU list of query strings, a different
// shape entirely). Same defensive posture as both: every read/write is
// wrapped so quota errors and private mode degrade to "no cache".
//
// Keys: garten_discover_<uid>:<seedKey>. The seed key embeds the row's inputs
// (see discover.js), so changed inputs mean a fresh key — invalidation is
// structural, not time-based. pruneDiscoverRows clears keys the current seed
// lineup no longer produces, so abandoned rows don't linger for their TTL.

const TTL = 24 * 60 * 60 * 1000
const PREFIX = 'garten_discover_'
const VERSION = 1

function storageKey(userId, seedKey) {
  return `${PREFIX}${userId || 'anon'}:${seedKey}`
}

// The raw fetched books for a seed, or null on a miss (absent, expired, or
// written by a different cache version). An empty array is a valid hit — it
// records "this seed found nothing today" so the row doesn't refetch on
// every mount.
export function getDiscoverRow(userId, seedKey) {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(userId, seedKey))
    if (!raw) return null
    const { books, ts, v } = JSON.parse(raw)
    if (v !== VERSION || !Array.isArray(books)) {
      localStorage.removeItem(storageKey(userId, seedKey))
      return null
    }
    if (Date.now() - ts > TTL) {
      localStorage.removeItem(storageKey(userId, seedKey))
      return null
    }
    return books
  } catch (e) {
    return null
  }
}

export function setDiscoverRow(userId, seedKey, books) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      storageKey(userId, seedKey),
      JSON.stringify({ books: books || [], ts: Date.now(), v: VERSION })
    )
  } catch (e) {
    // Quota exceeded or private mode — Discover just refetches next time.
  }
}

// Drop this user's rows whose seed keys aren't in the active lineup.
export function pruneDiscoverRows(userId, activeKeys = []) {
  if (typeof localStorage === 'undefined') return
  try {
    const prefix = `${PREFIX}${userId || 'anon'}:`
    const active = new Set(activeKeys.map((k) => `${prefix}${k}`))
    const stale = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix) && !active.has(k)) stale.push(k)
    }
    for (const k of stale) localStorage.removeItem(k)
  } catch (e) {
  }
}
