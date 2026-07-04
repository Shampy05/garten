import { describe, it, expect } from 'vitest'
import { normalizeVolume, filterByLanguage, hasIsbn } from './googleBooks.js'

describe('normalizeVolume', () => {
  it('maps a complete volume payload', () => {
    const volume = {
      id: 'abc123',
      volumeInfo: {
        title: 'Le Petit Prince',
        authors: ['Antoine de Saint-Exupéry'],
        description: 'A pilot stranded in the desert.',
        language: 'fr',
        imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
      },
    }
    expect(normalizeVolume(volume)).toEqual({
      externalId: 'abc123',
      title: 'Le Petit Prince',
      author: 'Antoine de Saint-Exupéry',
      coverUrl: 'https://books.google.com/cover.jpg',
      description: 'A pilot stranded in the desert.',
      languageCode: 'fr',
      pageCount: null,
      isbn: null,
      publishedDate: null,
    })
  })

  it('joins multiple authors', () => {
    const v = { id: 'x', volumeInfo: { authors: ['A. One', 'B. Two'], language: 'de' } }
    expect(normalizeVolume(v).author).toBe('A. One, B. Two')
  })

  it('tolerates missing author, cover and description', () => {
    const v = { id: 'y', volumeInfo: { title: 'Bare', language: 'es' } }
    expect(normalizeVolume(v)).toEqual({
      externalId: 'y',
      title: 'Bare',
      author: null,
      coverUrl: null,
      description: null,
      languageCode: 'es',
      pageCount: null,
      isbn: null,
      publishedDate: null,
    })
  })

  it('falls back to smallThumbnail and an Untitled title', () => {
    const v = {
      id: 'z',
      volumeInfo: { imageLinks: { smallThumbnail: 'https://x/small.jpg' } },
    }
    const out = normalizeVolume(v)
    expect(out.title).toBe('Untitled')
    expect(out.coverUrl).toBe('https://x/small.jpg')
  })
})

describe('filterByLanguage (FR3 strict filter)', () => {
  const books = [
    { externalId: '1', languageCode: 'fr' },
    { externalId: '2', languageCode: 'en' },
    { externalId: '3', languageCode: 'fr' },
  ]

  it('keeps only the selected language', () => {
    expect(filterByLanguage(books, 'fr').map((b) => b.externalId)).toEqual(['1', '3'])
  })

  it('returns everything when no language is selected', () => {
    expect(filterByLanguage(books, null)).toHaveLength(3)
  })
})

describe('hasIsbn (quality gate)', () => {
  it('keeps a volume with an ISBN_13', () => {
    const v = { id: 'a', volumeInfo: { industryIdentifiers: [{ type: 'ISBN_13', identifier: '9783446249578' }] } }
    expect(hasIsbn(v)).toBe(true)
  })

  it('keeps a volume with an ISBN_10', () => {
    const v = { id: 'b', volumeInfo: { industryIdentifiers: [{ type: 'ISBN_10', identifier: '3446249575' }] } }
    expect(hasIsbn(v)).toBe(true)
  })

  it('drops a scanned document whose only id is OTHER', () => {
    const v = { id: 'c', volumeInfo: { industryIdentifiers: [{ type: 'OTHER', identifier: 'BSB:BSB1234' }] } }
    expect(hasIsbn(v)).toBe(false)
  })

  it('drops a volume with no identifiers at all', () => {
    expect(hasIsbn({ id: 'd', volumeInfo: { title: 'Bare' } })).toBe(false)
  })
})
