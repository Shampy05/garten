// Google Books integration — the live source of book metadata. Nothing here is
// persisted in bulk; only books the user explicitly saves are written to
// Supabase (see useBooks.js). Pure functions so the normaliser and the strict
// language filter can be unit-tested without the network.

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes'

// Optional — keyless requests work fine at low volume. When set, the key raises
// the quota. Vite inlines import.meta.env at build time.
const API_KEY = import.meta.env?.VITE_GOOGLE_BOOKS_KEY || ''

// Force https on Google's cover thumbnails (they're sometimes served as http,
// which a https page will block as mixed content).
function httpsify(url) {
  if (!url) return null
  return url.replace(/^http:\/\//i, 'https://')
}

// ISBN-13 first, then ISBN-10. Used for the cross-source dedupe in
// bookSearch.js — the same book from two sources ties on its ISBN.
function extractIsbn(volume) {
  const ids = volume?.volumeInfo?.industryIdentifiers
  if (!Array.isArray(ids)) return null
  const isbn13 = ids.find((i) => i?.type === 'ISBN_13')?.identifier
  if (isbn13) return isbn13
  const isbn10 = ids.find((i) => i?.type === 'ISBN_10')?.identifier
  if (isbn10) return isbn10
  return null
}

// Map a raw Google Books volume into the shape the app stores/displays. Every
// field is optional on Google's side, so each access is guarded. `source` is
// stamped by the caller (the orchestrator), not by us, so the same normaliser
// can run for both the page-1 fetch and any future search variants.
export function normalizeVolume(v) {
  const info = v?.volumeInfo ?? {}
  const authors = Array.isArray(info.authors) ? info.authors : []
  return {
    externalId: v?.id ?? null,
    title: info.title ?? 'Untitled',
    author: authors.length ? authors.join(', ') : null,
    coverUrl: httpsify(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null),
    description: info.description ?? null,
    languageCode: info.language ?? null,
    pageCount: info.pageCount ?? null,
    isbn: extractIsbn(v),
    publishedDate: info.publishedDate ?? null,
  }
}

// Keep only books that actually match the selected language. `langRestrict`
// biases Google's results but does not strictly guarantee them, so FR3 ("only
// books in that language are returned") is enforced here on the client.
export function filterByLanguage(books, languageCode) {
  if (!languageCode) return books
  return books.filter((b) => b.languageCode === languageCode)
}

// A real published book carries an ISBN-10 or ISBN-13. Google's results are
// padded with scanned periodicals and public-domain documents (old Reichstag
// reports, encyclopedias, journals) whose only identifier is Google's internal
// "OTHER" id — these are the obscure, often mojibake-laden entries. Requiring an
// ISBN keeps clean, cataloged editions and drops the scans. Operates on the raw
// Google volume (before normalisation) since identifiers aren't part of the
// stored shape.
export function hasIsbn(volume) {
  const ids = volume?.volumeInfo?.industryIdentifiers
  if (!Array.isArray(ids)) return false
  return ids.some((i) => i?.type === 'ISBN_13' || i?.type === 'ISBN_10')
}

function buildUrl({ query, languageCode, startIndex = 0, maxResults = 20 }) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    startIndex: String(startIndex),
    printType: 'books',
    // Drop incomplete records that have no usable metadata. industryIdentifiers
    // is requested so hasIsbn() can filter out scanned/public-domain documents.
    fields: 'items(id,volumeInfo(title,authors,description,language,pageCount,publishedDate,industryIdentifiers,imageLinks/thumbnail,imageLinks/smallThumbnail)),totalItems',
  })
  if (languageCode) params.set('langRestrict', languageCode)
  if (API_KEY) params.set('key', API_KEY)
  return `${ENDPOINT}?${params.toString()}`
}

// Page-1 convenience: keeps the old single-page shape so the rest of the app
// (and tests) that only need one batch can stay terse.
export async function searchGoogleBooks({ query, languageCode = null } = {}) {
  const res = await searchGoogleBooksPage({ query, languageCode, page: 1, pageSize: 20 })
  return res.books
}

// Paginated Google Books. Returns { books, hasMore } where hasMore is true if
// Google still has more results beyond the current page. Throws on a non-OK
// response (e.g. 429) so the orchestrator in bookSearch.js can either fall
// back or merge with the other source.
export async function searchGoogleBooksPage({ query, languageCode = null, page = 1, pageSize = 20 } = {}) {
  const q = (query || '').trim()
  if (!q) return { books: [], hasMore: false, totalItems: 0 }

  const startIndex = (page - 1) * pageSize
  const res = await fetch(buildUrl({ query: q, languageCode, startIndex, maxResults: pageSize }))
  if (!res.ok) {
    throw new Error(`Google Books request failed (${res.status})`)
  }
  const data = await res.json()
  const items = Array.isArray(data.items) ? data.items : []
  const totalItems = typeof data.totalItems === 'number' ? data.totalItems : 0

  // ISBN gate first (raw volumes carry the identifiers), then normalise + the
  // strict language filter. The orchestrator stamps the source after.
  const normalized = items.filter(hasIsbn).map(normalizeVolume).filter((b) => b.externalId)
  const filtered = filterByLanguage(normalized, languageCode)
  const hasMore = startIndex + items.length < totalItems
  return { books: filtered, hasMore, totalItems }
}
