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
