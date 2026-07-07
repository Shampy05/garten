import { describe, it, expect } from 'vitest'
import {
  moreByAuthorSeed,
  becauseFinishedSeed,
  shortReadsSeed,
  laggingLanguage,
  buildDiscoverSeeds,
  filterRowBooks,
  MAX_ROWS,
  ROW_SIZE,
  SHORT_READ_MAX_PAGES,
  RATING_FLOOR,
} from './discover.js'

const TODAY = '2026-07-07'

function finished(id, { author = 'Anna Author', languageCode = 'fr', rating = null, finishedAt = '2026-06-01', title = `Book ${id}` } = {}) {
  return {
    id,
    externalId: `ext-${id}`,
    title,
    author,
    languageCode,
    record: { status: 'read', rating, finishedAt },
  }
}

function entry(languageId, date, minutes = 30) {
  return { languageId, date, hours: 0, minutes }
}

const FRENCH = { id: 'french', name: 'French' }
const SPANISH = { id: 'spanish', name: 'Spanish' }

describe('moreByAuthorSeed', () => {
  it('seeds from a finished book rated at the floor or above', () => {
    const seed = moreByAuthorSeed([finished('a', { rating: RATING_FLOOR })], TODAY)
    expect(seed.kind).toBe('more_by_author')
    expect(seed.query).toBe('Anna Author')
    expect(seed.languageCode).toBe('fr')
    expect(seed.title).toBe('More by Anna Author')
    expect(seed.reason).toBe('Because you loved Book a.')
    expect(seed.key).toBe('author:anna author:fr')
  })

  it('ignores unloved, unfinished, and authorless books', () => {
    const books = [
      finished('low', { rating: 3.5 }),
      finished('noAuthor', { rating: 5, author: null }),
      { id: 'reading', author: 'X', languageCode: 'fr', record: { status: 'reading', rating: 5 } },
    ]
    expect(moreByAuthorSeed(books, TODAY)).toBeNull()
  })

  it('rotates daily across distinct loved authors', () => {
    const books = [
      finished('a', { rating: 5, author: 'Author One', finishedAt: '2026-06-02' }),
      finished('b', { rating: 4, author: 'Author Two', finishedAt: '2026-06-01' }),
    ]
    const day1 = moreByAuthorSeed(books, '2026-07-07')
    const day2 = moreByAuthorSeed(books, '2026-07-08')
    expect(day1.query).not.toBe(day2.query)
    expect([day1.query, day2.query].sort()).toEqual(['Author One', 'Author Two'])
  })

  it('offers each author once, keyed by their most recent loved finish', () => {
    const books = [
      finished('new', { rating: 5, author: 'Same Author', finishedAt: '2026-06-05', title: 'Newer' }),
      finished('old', { rating: 5, author: 'same author', finishedAt: '2026-01-01', title: 'Older' }),
    ]
    // Only one candidate → same pick every day, seeded from the newer finish.
    expect(moreByAuthorSeed(books, '2026-07-07').reason).toBe('Because you loved Newer.')
    expect(moreByAuthorSeed(books, '2026-07-08').reason).toBe('Because you loved Newer.')
  })
})

describe('becauseFinishedSeed', () => {
  it('seeds from the most recent finish regardless of rating', () => {
    const books = [
      finished('a', { finishedAt: '2026-06-01', author: 'Old Author' }),
      finished('b', { finishedAt: '2026-06-20', author: 'New Author', title: 'The Latest' }),
    ]
    const seed = becauseFinishedSeed(books)
    expect(seed.kind).toBe('because_finished')
    expect(seed.title).toBe('Because you finished The Latest')
    expect(seed.query).toBe('New Author')
    expect(seed.key).toBe('finished:ext-b')
  })

  it('skips the excluded author so two rows never duplicate', () => {
    const books = [
      finished('a', { finishedAt: '2026-06-20', author: 'Loved Author' }),
      finished('b', { finishedAt: '2026-06-01', author: 'Other Author' }),
    ]
    expect(becauseFinishedSeed(books, 'loved author').query).toBe('Other Author')
    expect(becauseFinishedSeed(books, 'Nobody')).not.toBeNull()
  })

  it('returns null when every finish is by the excluded author', () => {
    expect(becauseFinishedSeed([finished('a')], 'Anna Author')).toBeNull()
    expect(becauseFinishedSeed([])).toBeNull()
  })
})

describe('laggingLanguage', () => {
  it('needs at least two languages in the curated reading set', () => {
    expect(laggingLanguage([], [FRENCH], TODAY)).toBeNull()
    expect(laggingLanguage([], [FRENCH, { id: 'klingon', name: 'Klingon' }], TODAY)).toBeNull()
  })

  it('picks the language with the least recent study time', () => {
    const entries = [entry('french', '2026-07-01', 120), entry('spanish', '2026-07-01', 10)]
    expect(laggingLanguage(entries, [FRENCH, SPANISH], TODAY)?.code).toBe('es')
  })

  it('ignores entries outside the window', () => {
    const entries = [
      entry('french', '2026-07-01', 10),
      entry('spanish', '2026-01-01', 500), // long ago — doesn't count
    ]
    expect(laggingLanguage(entries, [FRENCH, SPANISH], TODAY)?.code).toBe('es')
  })
})

describe('shortReadsSeed', () => {
  it('builds a short-reads row for the lagging language', () => {
    const entries = [entry('french', '2026-07-01', 120)]
    const seed = shortReadsSeed(entries, [FRENCH, SPANISH], [], TODAY)
    expect(seed.kind).toBe('short_reads')
    expect(seed.languageCode).toBe('es')
    expect(seed.title).toBe('Short reads in Spanish')
    expect(seed.postFilter).toEqual({ maxPages: SHORT_READ_MAX_PAGES, sort: 'shortest' })
  })

  it('returns null for a single-language gardener', () => {
    expect(shortReadsSeed([], [FRENCH], [], TODAY)).toBeNull()
  })
})

describe('buildDiscoverSeeds', () => {
  it('drops inapplicable rows and never exceeds MAX_ROWS', () => {
    expect(buildDiscoverSeeds({ today: TODAY })).toEqual([])
    const full = buildDiscoverSeeds({
      savedBooks: [
        finished('a', { rating: 5, author: 'Loved Author', finishedAt: '2026-06-20' }),
        finished('b', { author: 'Other Author', finishedAt: '2026-06-10' }),
      ],
      entries: [entry('french', '2026-07-01', 120)],
      languages: [FRENCH, SPANISH],
      today: TODAY,
    })
    expect(full.length).toBe(MAX_ROWS)
    expect(full.map((s) => s.kind)).toEqual(['more_by_author', 'because_finished', 'short_reads'])
  })

  it('keeps the finished row from repeating the loved row’s author', () => {
    const seeds = buildDiscoverSeeds({
      savedBooks: [finished('a', { rating: 5, author: 'Only Author', finishedAt: '2026-06-20' })],
      today: TODAY,
    })
    expect(seeds.map((s) => s.kind)).toEqual(['more_by_author'])
  })
})

describe('filterRowBooks', () => {
  const raw = (id, pageCount = null) => ({ externalId: id, pageCount })

  it('drops saved and cross-row books, cuts to ROW_SIZE', () => {
    const books = Array.from({ length: 10 }, (_, i) => raw(`b${i}`))
    const out = filterRowBooks(books, {
      savedExternalIds: new Set(['b0']),
      excludeExternalIds: new Set(['b1']),
    })
    expect(out.length).toBe(ROW_SIZE)
    expect(out.map((b) => b.externalId)).not.toContain('b0')
    expect(out.map((b) => b.externalId)).not.toContain('b1')
  })

  it('applies the page cap (unknown counts drop) and shortest sort', () => {
    const books = [raw('long', 900), raw('unknown'), raw('short', 90), raw('mid', 200)]
    const out = filterRowBooks(books, { maxPages: SHORT_READ_MAX_PAGES, sort: 'shortest' })
    expect(out.map((b) => b.externalId)).toEqual(['short', 'mid'])
  })
})
