import { describe, it, expect, beforeEach } from 'vitest'
import { getCached, setCache, CACHE_VERSION_TAG } from './cache.js'

// Vitest's default node environment doesn't ship localStorage. Stub a minimal
// in-memory implementation so cache.js reads + writes work the way they do
// in the browser. Each test gets a fresh store via beforeEach.
const store = new Map()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
})

describe('cache', () => {
  it('round-trips data for the same user', () => {
    setCache('alice', { foo: 'bar' })
    expect(getCached('alice')).toEqual({ foo: 'bar' })
  })

  it('returns null for a different user', () => {
    setCache('alice', { foo: 'bar' })
    expect(getCached('bob')).toBeNull()
  })

  it('returns null for a missing entry', () => {
    expect(getCached('alice')).toBeNull()
  })

  it('expires entries older than the TTL (30s)', () => {
    setCache('alice', { foo: 'bar' })
    // Manually rewind the timestamp by 31s so the next read sees a stale entry.
    const raw = localStorage.getItem('garten_data_alice')
    const parsed = JSON.parse(raw)
    parsed.ts = Date.now() - 31_000
    localStorage.setItem('garten_data_alice', JSON.stringify(parsed))
    expect(getCached('alice')).toBeNull()
    // Stale entries are cleaned up, not just ignored.
    expect(localStorage.getItem('garten_data_alice')).toBeNull()
  })

  it('stamps every write with the current cache version', () => {
    setCache('alice', { foo: 'bar' })
    const raw = localStorage.getItem('garten_data_alice')
    const parsed = JSON.parse(raw)
    expect(parsed.v).toBe(CACHE_VERSION_TAG)
    expect(parsed.ts).toBeGreaterThan(0)
  })

  it('rejects cache entries written by a previous version (the partner bug fix)', () => {
    // The 5d6b8c3 save race could leave a book in Supabase with no entry in
    // the local cache. A version bump forces every affected user to re-fetch
    // on their next page load instead of waiting 30s for the TTL to expire —
    // and instead of being silently re-stamped by every subsequent mutation.
    setCache('alice', { books: [] })
    const raw = localStorage.getItem('garten_data_alice')
    const parsed = JSON.parse(raw)
    // Simulate an older app version's cache (no `v` field at all).
    delete parsed.v
    localStorage.setItem('garten_data_alice', JSON.stringify(parsed))
    expect(getCached('alice')).toBeNull()
    expect(localStorage.getItem('garten_data_alice')).toBeNull()
  })

  it('rejects cache entries from a newer version (forward-compat)', () => {
    // A downgrade should not crash on a shape the old code doesn't know how
    // to read — the safe default is to ignore the entry and re-fetch.
    setCache('alice', { foo: 'bar' })
    const raw = localStorage.getItem('garten_data_alice')
    const parsed = JSON.parse(raw)
    parsed.v = CACHE_VERSION_TAG + 99
    localStorage.setItem('garten_data_alice', JSON.stringify(parsed))
    expect(getCached('alice')).toBeNull()
  })

  it('does not let one user\'s cache shadow another\'s data', () => {
    setCache('alice', { foo: 'alice' })
    setCache('bob', { foo: 'bob' })
    expect(getCached('alice')).toEqual({ foo: 'alice' })
    expect(getCached('bob')).toEqual({ foo: 'bob' })
  })
})
