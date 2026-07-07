// Book search orchestrator. The Library tab now merges results from Google
// Books (richest metadata, keyless quota is tight) and Open Library (keyless,
// quota-free) in parallel and dedupes them into one ranked list. Sort and
// secondary filters run on the merged set, in-memory, so the user can flip
// between "Shortest" and "Relevance" without a new API round-trip.
//
// dedupe key — preferred order:
//   1. ISBN (when both sides carry one for the same book)
//   2. normalised title + author + language (best effort for OL/Google
//      collisions across editions that share a title)
// When two results tie, the merged record keeps the one with more metadata
// (description, pageCount, cover) and tags source = 'merged' so the UI can
// note when both contributed.
//
// Sort and filter helpers are pure so they can be unit-tested without the
// network. Page-counters (`pickPageCount`, `detectPageCount`) stay as they
// were — they still need a working single-source search underneath.

import { searchGoogleBooksPage } from './googleBooks.js'
import { searchOpenLibraryPage } from './openLibrary.js'

// ── Dedupe ─────────────────────────────────────────────────────────────────

function normTitle(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}
function normAuthor(s) {
  return (s || '').toLowerCase().trim()
}
function dedupeKey(b) {
  if (b.isbn) return `isbn:${b.isbn}`
  return `tal:${normTitle(b.title)}|${normAuthor(b.author)}|${b.languageCode || ''}`
}

// Pick the richer of two duplicate book records. Counts filled optional fields
// (description, pageCount, coverUrl) and prefers the higher-scoring one. When
// scores tie, the first wins (stable). Used to merge Google + OL duplicates.
export function pickRicher(a, b) {
  const score = (x) =>
    (x.description ? 2 : 0) +
    (Number(x.pageCount) > 0 ? 1 : 0) +
    (x.coverUrl ? 1 : 0)
  const sa = score(a)
  const sb = score(b)
  if (sa >= sb) return { ...b, ...a }
  return { ...a, ...b }
}

// Dedupe a list of books (already normalised by their source). Preserves the
// first-seen order so the "relevance" sort remains predictable. Sets a
// `source: 'merged'` flag on a book when at least one of its duplicates
// originated from a different source — the UI uses that to attribute
// coverage in the "showing N books (Google · Open Library)" line.
export function dedupeBooks(books) {
  const out = []
  const seen = new Map()  // key → index in out
  for (const b of books) {
    const key = dedupeKey(b)
    if (!key) continue
    const idx = seen.get(key)
    if (idx == null) {
      seen.set(key, out.length)
      out.push({ ...b })
    } else {
      const existing = out[idx]
      const sources = new Set([existing.source, b.source].filter(Boolean))
      out[idx] = { ...pickRicher(existing, b), source: sources.size > 1 ? 'merged' : (existing.source || b.source) }
    }
  }
  return out
}

// ── Sort + filter (pure, in-memory) ────────────────────────────────────────

// Page-count bucketing for the secondary filter. Bounds chosen so a 320-page
// novel is "medium" and a 600-page epic is "long". Books without a known
// count pass no bucket and are hidden by the "Has page count" filter.
export const PAGE_RANGES = {
  short:  { label: 'Short',  max: 150 },
  medium: { label: 'Medium', min: 150, max: 400 },
  long:   { label: 'Long',   min: 400 },
}

export function sortBooks(books, sort = 'relevance') {
  const list = books.slice()
  if (sort === 'shortest') {
    list.sort((a, b) => {
      const ap = Number(a.pageCount) || 0
      const bp = Number(b.pageCount) || 0
      if (!ap && !bp) return 0
      if (!ap) return 1   // unknown → end
      if (!bp) return -1
      return ap - bp
    })
  } else if (sort === 'newest') {
    list.sort((a, b) => {
      const ay = parseInt(a.publishedDate, 10) || 0
      const by = parseInt(b.publishedDate, 10) || 0
      if (!ay && !by) return 0
      if (!ay) return 1
      if (!by) return -1
      return by - ay
    })
  }
  return list
}

export function applyFilters(books, filters = {}) {
  let list = books
  if (filters.pageRange && PAGE_RANGES[filters.pageRange]) {
    const { min, max } = PAGE_RANGES[filters.pageRange]
    list = list.filter((b) => {
      const p = Number(b.pageCount)
      if (!p) return false
      if (min != null && p < min) return false
      if (max != null && p >= max) return false
      return true
    })
  }
  if (filters.hasDescription) {
    list = list.filter((b) => b.description && b.description.trim().length > 0)
  }
  if (filters.hasPageCount) {
    list = list.filter((b) => Number(b.pageCount) > 0)
  }
  if (filters.alreadySaved) {
    // Inverted: with the toggle on, we WANT books that are already saved.
    // The caller passes a Set of saved externalIds.
    const set = filters.savedExternalIds instanceof Set ? filters.savedExternalIds : null
    if (set) list = list.filter((b) => set.has(b.externalId))
  }
  return list
}

// ── Orchestrator ───────────────────────────────────────────────────────────

// Returns { books, sources, hasMore, error }. `sources` is a Set of
// contributing source names so the UI can render a "Google · Open Library"
// attribution. `books` are already deduped but NOT yet sorted or filtered —
// the caller applies those in-memory, so flipping sort/filter doesn't need
// a new fetch.
export async function searchBooksMerged({ query, languageCode = null, page = 1, pageSize = 20 } = {}) {
  const q = (query || '').trim()
  if (!q) return { books: [], sources: new Set(), hasMore: false }

  // Fire both sources in parallel. OL is wrapped in a catch so a 429 / network
  // error from OL doesn't kill the whole request — Google alone is enough.
  const [googleRes, olRes] = await Promise.allSettled([
    searchGoogleBooksPage({ query: q, languageCode, page, pageSize }),
    searchOpenLibraryPage({ query: q, languageCode, page, pageSize }),
  ])

  const sources = new Set()
  let merged = []
  let hasMore = false
  let totalError = true

  if (googleRes.status === 'fulfilled') {
    totalError = false
    sources.add('google')
    for (const b of googleRes.value.books) merged.push({ ...b, source: 'google' })
    if (googleRes.value.hasMore) hasMore = true
  }
  if (olRes.status === 'fulfilled') {
    totalError = false
    sources.add('openlibrary')
    for (const b of olRes.value.books) merged.push({ ...b, source: 'openlibrary' })
    if (olRes.value.hasMore) hasMore = true
  }

  return {
    books: dedupeBooks(merged),
    sources,
    hasMore,
    error: totalError,
  }
}

// Pick the best page count for an already-saved book by re-searching its title.
// Books store no page count themselves (it only rides along on live search
// results), so this re-queries and matches back to the saved edition. Pure
// matching logic over the orchestrator's results — exported separately so it's
// unit-testable. Returns a positive integer, or null when nothing usable is
// found (caller leaves the field for manual entry).
export function pickPageCount(books, { externalId = null, title = null } = {}) {
  const withCount = (books || []).filter((b) => Number(b?.pageCount) > 0)
  if (!withCount.length) return null

  // 1. Same edition (most reliable — identical externalId).
  const sameId = externalId && withCount.find((b) => b.externalId === externalId)
  if (sameId) return Math.round(sameId.pageCount)

  // 2. Exact title match (case-insensitive), in case the id scheme differs
  //    (e.g. the book was saved from Google but we fell back to Open Library).
  const norm = (s) => (s || '').trim().toLowerCase()
  const sameTitle = title && withCount.find((b) => norm(b.title) === norm(title))
  if (sameTitle) return Math.round(sameTitle.pageCount)

  // 3. Otherwise the first cataloged result that carries a count.
  return Math.round(withCount[0].pageCount)
}

export async function detectPageCount({ title, author = null, externalId = null, languageCode = null } = {}) {
  const t = (title || '').trim()
  if (!t) return null
  const query = author ? `${t} ${author}` : t
  try {
    const { books } = await searchBooksMerged({ query, languageCode, page: 1, pageSize: 20 })
    return pickPageCount(books, { externalId, title: t })
  } catch (e) {
    return null
  }
}
