import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./googleBooks.js', () => ({ searchGoogleBooks: vi.fn() }))
vi.mock('./openLibrary.js', () => ({ searchOpenLibrary: vi.fn() }))

import { searchBooks, pickPageCount, detectPageCount } from './bookSearch.js'
import { searchGoogleBooks } from './googleBooks.js'
import { searchOpenLibrary } from './openLibrary.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('searchBooks orchestrator', () => {
  it('returns Google results when Google succeeds (no fallback)', async () => {
    searchGoogleBooks.mockResolvedValue([{ externalId: 'g1' }])
    const out = await searchBooks({ query: 'dune', languageCode: 'en' })
    expect(out).toEqual({ books: [{ externalId: 'g1' }], source: 'google' })
    expect(searchOpenLibrary).not.toHaveBeenCalled()
  })

  it('falls back to Open Library when Google throws (e.g. 429)', async () => {
    searchGoogleBooks.mockRejectedValue(new Error('429'))
    searchOpenLibrary.mockResolvedValue([{ externalId: '/works/OL1W' }])
    const out = await searchBooks({ query: 'dune', languageCode: 'en' })
    expect(out).toEqual({ books: [{ externalId: '/works/OL1W' }], source: 'openlibrary' })
    expect(searchOpenLibrary).toHaveBeenCalledWith({ query: 'dune', languageCode: 'en' })
  })

  it('does NOT fall back when Google succeeds but returns nothing', async () => {
    searchGoogleBooks.mockResolvedValue([])
    const out = await searchBooks({ query: 'zzz', languageCode: 'en' })
    expect(out).toEqual({ books: [], source: 'google' })
    expect(searchOpenLibrary).not.toHaveBeenCalled()
  })

  it('short-circuits on an empty query', async () => {
    const out = await searchBooks({ query: '   ' })
    expect(out).toEqual({ books: [], source: null })
    expect(searchGoogleBooks).not.toHaveBeenCalled()
    expect(searchOpenLibrary).not.toHaveBeenCalled()
  })
})

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

  it('otherwise uses the first result that carries a count', () => {
    expect(pickPageCount(books, { externalId: 'x', title: 'Unknown' })).toBe(412)
  })

  it('ignores results without a positive page count', () => {
    expect(pickPageCount([{ externalId: 'a', pageCount: 0 }, { externalId: 'b', pageCount: null }], {})).toBeNull()
  })

  it('rounds fractional counts', () => {
    expect(pickPageCount([{ externalId: 'a', title: 'x', pageCount: 320.6 }], { externalId: 'a' })).toBe(321)
  })

  it('returns null for empty input', () => {
    expect(pickPageCount([], { externalId: 'a' })).toBeNull()
    expect(pickPageCount(null, {})).toBeNull()
  })
})

describe('detectPageCount', () => {
  it('searches by title + author and matches the saved edition', async () => {
    searchGoogleBooks.mockResolvedValue([{ externalId: 'g9', title: 'Reunion', pageCount: 96 }])
    const pages = await detectPageCount({ title: 'Reunion', author: 'Fred Uhlman', externalId: 'g9', languageCode: 'en' })
    expect(pages).toBe(96)
    expect(searchGoogleBooks).toHaveBeenCalledWith({ query: 'Reunion Fred Uhlman', languageCode: 'en' })
  })

  it('returns null on an empty title without searching', async () => {
    const pages = await detectPageCount({ title: '  ' })
    expect(pages).toBeNull()
    expect(searchGoogleBooks).not.toHaveBeenCalled()
  })

  it('returns null when the search itself fails', async () => {
    searchGoogleBooks.mockRejectedValue(new Error('429'))
    searchOpenLibrary.mockRejectedValue(new Error('down'))
    const pages = await detectPageCount({ title: 'Reunion' })
    expect(pages).toBeNull()
  })
})
