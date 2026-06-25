// Book search orchestrator. Google Books gives the richest inline metadata, but
// its keyless quota is easily exhausted (HTTP 429). So we try Google first and,
// on any failure, fall back to keyless/quota-free Open Library — the user
// always gets results, with the better source when it's available.
//
// Returns { books, source } so the UI can quietly note when results came from
// the fallback. Only request errors trigger the fallback: a successful but
// empty Google response means Google genuinely found nothing, so we don't
// double up with a second request.

import { searchGoogleBooks } from './googleBooks.js'
import { searchOpenLibrary } from './openLibrary.js'

export async function searchBooks({ query, languageCode = null } = {}) {
  const q = (query || '').trim()
  if (!q) return { books: [], source: null }

  try {
    const books = await searchGoogleBooks({ query: q, languageCode })
    return { books, source: 'google' }
  } catch (googleErr) {
    // Google rate-limited or unreachable — fall back to Open Library.
    const books = await searchOpenLibrary({ query: q, languageCode })
    return { books, source: 'openlibrary' }
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
    const { books } = await searchBooks({ query, languageCode })
    return pickPageCount(books, { externalId, title: t })
  } catch (e) {
    return null
  }
}
