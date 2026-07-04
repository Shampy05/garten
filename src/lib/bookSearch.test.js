import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./googleBooks.js', () => ({
  searchGoogleBooksPage: vi.fn(),
  searchGoogleBooks: vi.fn(),
}))
vi.mock('./openLibrary.js', () => ({
  searchOpenLibraryPage: vi.fn(),
  searchOpenLibrary: vi.fn(),
}))

import {
  searchBooksMerged,
  sortBooks,
  applyFilters,
  pickPageCount,
  detectPageCount,
  pickRicher,
  recommendationSeed,
  searchRecommendations,
} from './bookSearch.js'
import { searchGoogleBooksPage } from './googleBooks.js'
import { searchOpenLibraryPage } from './openLibrary.js'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Merge orchestrator ────────────────────────────────────────────────────

describe('searchBooksMerged', () => {
  it('merges Google + Open Library results into one deduped list', async () => {
    searchGoogleBooksPage.mockResolvedValue({
      books: [
        { externalId: 'g1', title: 'Dune', author: 'Frank Herbert', source: 'google', isbn: '9780441172719' },
      ],
      hasMore: false,
      totalItems: 1,
    })
    searchOpenLibraryPage.mockResolvedValue({
      books: [
        { externalId: '/works/OL1W', title: 'Dune', author: 'Frank Herbert', source: 'openlibrary', isbn: '9780441172719' },
        { externalId: '/works/OL2W', title: 'Dune Messiah', author: 'Frank Herbert', source: 'openlibrary' },
      ],
      hasMore: false,
    })
    const out = await searchBooksMerged({ query: 'dune', languageCode: 'en', page: 1, pageSize: 20 })
    expect(out.sources.has('google')).toBe(true)
    expect(out.sources.has('openlibrary')).toBe(true)
    // The two "Dune" entries collapse to one (ISBN match), so 2 unique books.
    expect(out.books).toHaveLength(2)
    // The merged Dune should carry `source: 'merged'`.
    const dune = out.books.find((b) => b.title === 'Dune')
    expect(dune.source).toBe('merged')
  })

  it('returns only Google results when Open Library fails', async () => {
    searchGoogleBooksPage.mockResolvedValue({
      books: [{ externalId: 'g1', title: 'Dune', source: 'google' }],
      hasMore: false,
      totalItems: 1,
    })
    searchOpenLibraryPage.mockRejectedValue(new Error('down'))
    const out = await searchBooksMerged({ query: 'dune' })
    expect(out.books).toHaveLength(1)
    expect([...out.sources]).toEqual(['google'])
  })

  it('returns only Open Library results when Google fails', async () => {
    searchGoogleBooksPage.mockRejectedValue(new Error('429'))
    searchOpenLibraryPage.mockResolvedValue({
      books: [{ externalId: '/works/OL1W', title: 'Dune', source: 'openlibrary' }],
      hasMore: false,
    })
    const out = await searchBooksMerged({ query: 'dune' })
    expect(out.books).toHaveLength(1)
    expect([...out.sources]).toEqual(['openlibrary'])
    expect(out.error).toBe(false)  // partial success, not a total failure
  })

  it('short-circuits on an empty query', async () => {
    const out = await searchBooksMerged({ query: '   ' })
    expect(out.books).toEqual([])
    expect(searchGoogleBooksPage).not.toHaveBeenCalled()
    expect(searchOpenLibraryPage).not.toHaveBeenCalled()
  })

  it('hasMore is true if either source has more', async () => {
    searchGoogleBooksPage.mockResolvedValue({ books: [{ externalId: 'g1' }], hasMore: false, totalItems: 1 })
    searchOpenLibraryPage.mockResolvedValue({ books: [{ externalId: '/o/1' }], hasMore: true })
    const out = await searchBooksMerged({ query: 'dune' })
    expect(out.hasMore).toBe(true)
  })

  it('passes page + pageSize through to each source', async () => {
    searchGoogleBooksPage.mockResolvedValue({ books: [], hasMore: false, totalItems: 0 })
    searchOpenLibraryPage.mockResolvedValue({ books: [], hasMore: false })
    await searchBooksMerged({ query: 'dune', page: 3, pageSize: 10 })
    expect(searchGoogleBooksPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, pageSize: 10 })
    )
    expect(searchOpenLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, pageSize: 10 })
    )
  })
})

// ── pickRicher ────────────────────────────────────────────────────────────

describe('pickRicher', () => {
  it('prefers the entry with more metadata filled in', () => {
    const sparse = { title: 'Dune', description: null, pageCount: null, coverUrl: null }
    const rich   = { title: 'Dune', description: 'desc', pageCount: 412, coverUrl: 'u' }
    expect(pickRicher(sparse, rich)).toEqual(rich)
  })
  it('keeps the first when scores tie', () => {
    const a = { title: 'A', description: 'd', pageCount: null, coverUrl: null }
    const b = { title: 'A', description: null, pageCount: 5, coverUrl: null }
    expect(pickRicher(a, b).title).toBe('A')
  })
})

// ── sortBooks ─────────────────────────────────────────────────────────────

describe('sortBooks', () => {
  const books = [
    { title: 'B', pageCount: 400, publishedDate: '1990' },
    { title: 'A', pageCount: 100, publishedDate: '2020' },
    { title: 'C', pageCount: null, publishedDate: '2010' },
  ]

  it('returns input order for relevance', () => {
    expect(sortBooks(books, 'relevance').map((b) => b.title)).toEqual(['B', 'A', 'C'])
  })

  it('sorts by pageCount asc, missing last', () => {
    expect(sortBooks(books, 'shortest').map((b) => b.title)).toEqual(['A', 'B', 'C'])
  })

  it('sorts by publishedDate desc, missing last', () => {
    expect(sortBooks(books, 'newest').map((b) => b.title)).toEqual(['A', 'C', 'B'])
  })
})

// ── applyFilters ──────────────────────────────────────────────────────────

describe('applyFilters', () => {
  const books = [
    { externalId: 'a', pageCount: 100, description: 'A short one.' },
    { externalId: 'b', pageCount: 300, description: 'A medium one.' },
    { externalId: 'c', pageCount: 500, description: 'A long one.' },
    { externalId: 'd', pageCount: null, description: null },  // unknown everything
  ]

  it('filters by short page range', () => {
    expect(applyFilters(books, { pageRange: 'short' }).map((b) => b.externalId)).toEqual(['a'])
  })
  it('filters by medium page range', () => {
    expect(applyFilters(books, { pageRange: 'medium' }).map((b) => b.externalId)).toEqual(['b'])
  })
  it('filters by long page range', () => {
    expect(applyFilters(books, { pageRange: 'long' }).map((b) => b.externalId)).toEqual(['c'])
  })
  it('filters to only books with descriptions', () => {
    expect(applyFilters(books, { hasDescription: true }).map((b) => b.externalId)).toEqual(['a', 'b', 'c'])
  })
  it('filters to only books with a page count', () => {
    expect(applyFilters(books, { hasPageCount: true }).map((b) => b.externalId)).toEqual(['a', 'b', 'c'])
  })
  it('alreadySaved keeps only books in the supplied Set', () => {
    expect(applyFilters(books, { alreadySaved: true, savedExternalIds: new Set(['b', 'c']) }).map((b) => b.externalId)).toEqual(['b', 'c'])
  })
})

// ── pickPageCount (unchanged) ─────────────────────────────────────────────

describe('pickPageCount', () => {
  const books = [
    { externalId: 'g1', title: 'Dune', pageCount: 412 },
    { externalId: 'g2', title: 'Dune Messiah', pageCount: 256 },
    { externalId: 'g3', title: 'No Count', pageCount: null },
  ]

  it('prefers the same edition by externalId', () => {
    expect(pickPageCount(books, { externalId: 'g2' })).toBe(256)
  })

  it('falls back to an exact (case-insensitive) title match', () => {
    expect(pickPageCount(books, { externalId: 'nope', title: 'dune' })).toBe(412)
  })

  it('returns null for empty input', () => {
    expect(pickPageCount([], { externalId: 'a' })).toBeNull()
  })
})

// ── detectPageCount (now backed by the merged orchestrator) ───────────────

describe('detectPageCount', () => {
  it('searches by title + author and matches the saved edition', async () => {
    searchGoogleBooksPage.mockResolvedValue({
      books: [{ externalId: 'g9', title: 'Reunion', pageCount: 96 }],
      hasMore: false,
      totalItems: 1,
    })
    searchOpenLibraryPage.mockResolvedValue({ books: [], hasMore: false })
    const pages = await detectPageCount({ title: 'Reunion', author: 'Fred Uhlman', externalId: 'g9', languageCode: 'en' })
    expect(pages).toBe(96)
    expect(searchGoogleBooksPage).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Reunion Fred Uhlman', languageCode: 'en' })
    )
  })

  it('returns null on an empty title without searching', async () => {
    expect(await detectPageCount({ title: '  ' })).toBeNull()
    expect(searchGoogleBooksPage).not.toHaveBeenCalled()
  })

  it('returns null when both sources fail', async () => {
    searchGoogleBooksPage.mockRejectedValue(new Error('429'))
    searchOpenLibraryPage.mockRejectedValue(new Error('down'))
    expect(await detectPageCount({ title: 'X' })).toBeNull()
  })
})

// ── Recommendations ───────────────────────────────────────────────────────

describe('recommendationSeed', () => {
  it('returns null when no finished books exist', () => {
    expect(recommendationSeed([])).toBeNull()
  })
  it('returns null when finished books have no author or language', () => {
    expect(recommendationSeed([
      { record: { status: 'read', finishedAt: '2026-01-01' } },
    ])).toBeNull()
  })
  it('returns the most recently finished book with author + language', () => {
    const seed = recommendationSeed([
      { record: { status: 'read', finishedAt: '2025-12-01' }, author: 'A', languageCode: 'en' },
      { record: { status: 'read', finishedAt: '2026-03-15' }, author: 'B', languageCode: 'fr' },
    ])
    expect(seed).toEqual({ author: 'B', languageCode: 'fr', title: undefined })
  })
})

describe('searchRecommendations', () => {
  it('returns empty when there is no seed', async () => {
    const out = await searchRecommendations({ savedBooks: [] })
    expect(out.books).toEqual([])
    expect(out.seed).toBeNull()
    expect(searchGoogleBooksPage).not.toHaveBeenCalled()
  })

  it('filters out the user\'s saved copies from the recommendations', async () => {
    searchGoogleBooksPage.mockResolvedValue({
      books: [
        { externalId: 'g1', title: 'Book 1', source: 'google' },
        { externalId: 'g2', title: 'Book 2', source: 'google' },
      ],
      hasMore: false,
    })
    searchOpenLibraryPage.mockResolvedValue({ books: [], hasMore: false })
    const savedBooks = [
      { externalId: 'g1', author: 'A', languageCode: 'en', record: { status: 'read', finishedAt: '2026-01-01' } },
    ]
    const out = await searchRecommendations({ savedBooks })
    expect(out.books.map((b) => b.externalId)).toEqual(['g2'])
  })
})
