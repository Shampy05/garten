import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./googleBooks.js', () => ({ searchGoogleBooks: vi.fn() }))
vi.mock('./openLibrary.js', () => ({ searchOpenLibrary: vi.fn() }))

import { searchBooks } from './bookSearch.js'
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
