// Open Library integration — a keyless, quota-free fallback for when Google
// Books is rate-limited (see bookSearch.js). Open Library's Search API needs no
// key and has no daily cap, but it speaks ISO 639-2/B 3-letter language codes
// (fre, ger, jpn…) where the rest of the app uses ISO 639-1 (fr, de, ja). The
// maps below translate in both directions so results slot into the same data
// model and the `books.language_code` CHECK constraint.

import { filterByLanguage } from './googleBooks.js'

const ENDPOINT = 'https://openlibrary.org/search.json'

// ISO 639-1 → ISO 639-2/B, for the Search API's `language` filter. Covers the
// curated set in bookLanguages.js.
const ISO1_TO_OL = {
  ar: 'ara', zh: 'chi', cs: 'cze', da: 'dan', nl: 'dut', en: 'eng', fi: 'fin',
  fr: 'fre', de: 'ger', el: 'gre', he: 'heb', hi: 'hin', id: 'ind', it: 'ita',
  ja: 'jpn', ko: 'kor', no: 'nor', pl: 'pol', pt: 'por', ro: 'rum', ru: 'rus',
  es: 'spa', sv: 'swe', tr: 'tur', uk: 'ukr', vi: 'vie',
}

// Reverse map for normalising result languages back to ISO 639-1. Built from
// the table above, plus the ISO 639-2/T variants Open Library sometimes emits
// (e.g. fra/deu/nld/ces/zho/ron/ell), so both forms resolve.
const OL_TO_ISO1 = {
  ...Object.fromEntries(Object.entries(ISO1_TO_OL).map(([iso1, ol]) => [ol, iso1])),
  fra: 'fr', deu: 'de', nld: 'nl', ces: 'cs', zho: 'zh', ron: 'ro', ell: 'el',
}

function coverUrl(coverId) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
}

// Mirror googleBooks' ISBN gate: keep only works that have at least one ISBN, so
// scanned periodicals and public-domain documents (which carry no ISBN) are
// dropped and the fallback returns the same clean, cataloged editions.
export function hasIsbn(doc) {
  return Array.isArray(doc?.isbn) && doc.isbn.length > 0
}

// Prefer ISBN-13 (more specific), fall back to whatever the first ISBN is. Used
// for the cross-source dedupe in bookSearch.js.
function extractIsbn(doc) {
  if (!Array.isArray(doc?.isbn)) return null
  const isbn13 = doc.isbn.find((i) => typeof i === 'string' && i.length === 13)
  if (isbn13) return isbn13
  return doc.isbn[0] || null
}

function firstSentence(value) {
  if (Array.isArray(value)) return value[0] ?? null
  if (typeof value === 'string') return value
  return null
}

// Map an Open Library search `doc` into the app's normalised book shape. When a
// language was requested the API has already filtered to it, so we adopt the
// requested ISO 639-1 code directly; otherwise we translate the doc's first
// recognised language. `key` (e.g. "/works/OL123W") is a stable external id.
export function normalizeDoc(doc, requestedCode = null) {
  const authors = Array.isArray(doc?.author_name) ? doc.author_name : []
  let languageCode = requestedCode
  if (!languageCode && Array.isArray(doc?.language)) {
    for (const code of doc.language) {
      if (OL_TO_ISO1[code]) {
        languageCode = OL_TO_ISO1[code]
        break
      }
    }
  }
  return {
    externalId: doc?.key ?? null,
    title: doc?.title ?? 'Untitled',
    author: authors.length ? authors.join(', ') : null,
    coverUrl: coverUrl(doc?.cover_i),
    description: firstSentence(doc?.first_sentence),
    languageCode: languageCode ?? null,
    pageCount: doc?.number_of_pages_median ?? doc?.number_of_pages ?? null,
    isbn: extractIsbn(doc),
    publishedDate: doc?.first_publish_year ? String(doc.first_publish_year) : null,
  }
}

function buildUrl({ query, languageCode, page = 1, pageSize = 20 }) {
  const params = new URLSearchParams({
    q: query,
    limit: String(pageSize),
    page: String(page),
    fields: 'key,title,author_name,cover_i,first_sentence,language,isbn,number_of_pages_median,first_publish_year',
  })
  const ol = languageCode ? ISO1_TO_OL[languageCode] : null
  if (ol) params.set('language', ol)
  return `${ENDPOINT}?${params.toString()}`
}

// Page-1 convenience: same single-page shape as the old API.
export async function searchOpenLibrary({ query, languageCode = null } = {}) {
  const res = await searchOpenLibraryPage({ query, languageCode, page: 1, pageSize: 20 })
  return res.books
}

// Paginated Open Library. Returns { books, hasMore } where hasMore is true if
// Open Library returned a full page (it caps results at 100/page and doesn't
// expose a total count, so "has more" is best-effort).
export async function searchOpenLibraryPage({ query, languageCode = null, page = 1, pageSize = 20 } = {}) {
  const q = (query || '').trim()
  if (!q) return { books: [], hasMore: false }

  const res = await fetch(buildUrl({ query: q, languageCode, page, pageSize }))
  if (!res.ok) {
    throw new Error(`Open Library request failed (${res.status})`)
  }
  const data = await res.json()
  const docs = Array.isArray(data.docs) ? data.docs : []
  // ISBN gate (mirrors googleBooks) → normalise → strict language filter.
  const normalized = docs.filter(hasIsbn).map((d) => normalizeDoc(d, languageCode)).filter((b) => b.externalId)
  const filtered = filterByLanguage(normalized, languageCode)
  // OL doesn't expose a total count, so we infer "has more" from a full page.
  const hasMore = docs.length >= pageSize
  return { books: filtered, hasMore }
}
