import { describe, it, expect } from 'vitest'
import { normalizeDoc, hasIsbn } from './openLibrary.js'

describe('normalizeDoc', () => {
  it('maps a doc and adopts the requested language code', () => {
    const doc = {
      key: '/works/OL27448W',
      title: 'Le Petit Prince',
      author_name: ['Antoine de Saint-Exupéry'],
      cover_i: 12345,
      first_sentence: ['Once when I was six years old…'],
      language: ['fre'],
    }
    expect(normalizeDoc(doc, 'fr')).toEqual({
      externalId: '/works/OL27448W',
      title: 'Le Petit Prince',
      author: 'Antoine de Saint-Exupéry',
      coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
      description: 'Once when I was six years old…',
      languageCode: 'fr',
    })
  })

  it('translates the doc language when none was requested', () => {
    const doc = { key: '/works/x', title: 'Faust', language: ['ger'] }
    expect(normalizeDoc(doc).languageCode).toBe('de')
  })

  it('resolves ISO 639-2/T variants Open Library sometimes emits', () => {
    const doc = { key: '/works/y', title: 'X', language: ['deu'] }
    expect(normalizeDoc(doc).languageCode).toBe('de')
  })

  it('yields a null languageCode for an unrecognised language', () => {
    const doc = { key: '/works/z', title: 'X', language: ['lat'] }
    expect(normalizeDoc(doc).languageCode).toBeNull()
  })

  it('tolerates missing author, cover and sentence', () => {
    const doc = { key: '/works/bare', title: 'Bare' }
    expect(normalizeDoc(doc, 'es')).toMatchObject({
      author: null,
      coverUrl: null,
      description: null,
      languageCode: 'es',
    })
  })
})

describe('hasIsbn (quality gate)', () => {
  it('keeps a doc with at least one ISBN', () => {
    expect(hasIsbn({ key: '/works/x', isbn: ['9783518467282'] })).toBe(true)
  })

  it('drops a doc with no isbn array (scanned/public-domain)', () => {
    expect(hasIsbn({ key: '/works/y', title: 'Reichstag report' })).toBe(false)
  })

  it('drops a doc with an empty isbn array', () => {
    expect(hasIsbn({ key: '/works/z', isbn: [] })).toBe(false)
  })
})
