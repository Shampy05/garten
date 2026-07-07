import { describe, it, expect } from 'vitest'
import {
  moreByAuthorSeed,
  becauseFinishedSeed,
  laggingLanguage,
  buildDiscoverSeeds,
  filterRowBooks,
  topContentWords,
  moreLikeThisSeed,
  MAX_ROWS,
  ROW_SIZE,
  SHORT_READ_MAX_PAGES,
  RATING_FLOOR,
} from './discover.js'

const TODAY = '2026-07-07'

function finished(id, opts = {}) {
  const { author = 'Anna Author', languageCode = 'fr', rating = null, finishedAt = '2026-06-01', title = `Book ${id}`, description = '' } = opts
  return {
    id,
    externalId: `ext-${id}`,
    title,
    author,
    languageCode,
    description,
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
  it('needs at least one language in the curated reading set', () => {
    expect(laggingLanguage([], [], TODAY)).toBeNull()
    expect(laggingLanguage([], [{ id: 'klingon', name: 'Klingon' }], TODAY)).toBeNull()
  })

  it('returns the single codable language when only one is tracked', () => {
    expect(laggingLanguage([], [FRENCH], TODAY)?.code).toBe('fr')
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

describe('buildDiscoverSeeds', () => {
  it('returns an empty lineup when there is no library yet', () => {
    expect(buildDiscoverSeeds({ today: TODAY })).toEqual([])
  })

  it('shows loved + finished + more-like-this in order and never exceeds MAX_ROWS', () => {
    const seeds = buildDiscoverSeeds({
      savedBooks: [
        finished('a', {
          rating: 5,
          author: 'Loved Author',
          finishedAt: '2026-06-20',
          description:
            'A sweeping family story about memory, war, and the long shadow of the past across generations of one household in a small town.',
        }),
        finished('b', {
          author: 'Other Author',
          finishedAt: '2026-06-10',
          description:
            'A mystery in which a young detective must untangle family secrets to find the missing person before time runs out.',
        }),
      ],
      languages: [FRENCH, SPANISH],
      today: TODAY,
    })
    expect(seeds.length).toBe(3)
    expect(seeds.map((s) => s.kind)).toEqual(['more_by_author', 'because_finished', 'more_like_this'])
  })

  it('keeps the finished row from repeating the loved row’s author', () => {
    const seeds = buildDiscoverSeeds({
      savedBooks: [finished('a', { rating: 5, author: 'Only Author', finishedAt: '2026-06-20' })],
      today: TODAY,
    })
    expect(seeds.map((s) => s.kind)).toEqual(['more_by_author'])
  })

  it('falls back to just the finished row when no loved book qualifies', () => {
    const seeds = buildDiscoverSeeds({
      savedBooks: [finished('a', { rating: 3, author: 'Casual Author', finishedAt: '2026-06-20' })],
      today: TODAY,
    })
    expect(seeds.map((s) => s.kind)).toEqual(['because_finished'])
  })

  it('MAX_ROWS is 3 — loved, finished, and more-like-this', () => {
    expect(MAX_ROWS).toBe(3)
  })
})

describe('topContentWords', () => {
  it('returns the most frequent content words in the order they appear', () => {
    const passage =
      'A mystery about a mystery writer who writes a mystery in a mystery town. ' +
      'Family, memory, and war echo through the chapters and the chapters echo the chapters.'
    const out = topContentWords(passage, { count: 4, languageCode: 'en' })
    // Frequencies: mystery=4, chapters=3, echo=2, then a cluster of 1s
    // (writer, writes, town, family, memory, war) — ties break by
    // first-occurrence, so writer wins the 4th slot.
    expect(out[0]).toBe('mystery')
    expect(out).toEqual(['mystery', 'chapters', 'echo', 'writer'])
    // Stopword-free: no 'the', 'and', 'about', 'a'.
    expect(topContentWords(passage, { languageCode: 'en' })).not.toContain('the')
  })

  it('uses English stopwords when languageCode is "en"', () => {
    const out = topContentWords('the cat sat on the mat the cat', { languageCode: 'en' })
    // Frequencies: cat=2, mat=1, sat=1. Ties break by first occurrence:
    // sat (pos 4) before mat (pos 6).
    expect(out).toEqual(['cat', 'sat', 'mat'])
  })

  it('falls back to no stopword filtering for unsupported languages', () => {
    // Esperanto isn't in stopwords.js; the words "kaj", "la" would slip
    // through. The output reflects that honest gap.
    const out = topContentWords('kaj la hundo kaj la kato en la ĝardeno', { languageCode: 'eo' })
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns [] for empty or whitespace-only input', () => {
    expect(topContentWords('')).toEqual([])
    expect(topContentWords('   ')).toEqual([])
  })

  it('respects the count option', () => {
    const out = topContentWords('alpha beta alpha gamma beta alpha delta', { count: 2 })
    expect(out).toEqual(['alpha', 'beta'])
  })
})

describe('moreLikeThisSeed', () => {
  const richDescription =
    'A sweeping family story about memory, war, and the long shadow of the past ' +
    'across generations of one household in a small town by the river.'

  it('returns null when there are no finished books with descriptions', () => {
    expect(moreLikeThisSeed([finished('a')], [FRENCH], TODAY)).toBeNull()
  })

  it('skips books whose language the user is no longer watering', () => {
    // English isn't tracked here, so an English finish with a great
    // description is ignored. Tracked codes: fr (FRENCH) only.
    const books = [
      finished('a', {
        languageCode: 'en',
        finishedAt: '2026-06-20',
        description: richDescription,
      }),
    ]
    expect(moreLikeThisSeed(books, [FRENCH], TODAY)).toBeNull()
  })

  it('seeds from the most recently finished tracked-language book', () => {
    const books = [
      finished('older', {
        languageCode: 'fr',
        finishedAt: '2026-06-01',
        description: richDescription,
      }),
      finished('newer', {
        languageCode: 'fr',
        finishedAt: '2026-06-20',
        title: 'The Newer Book',
        description: richDescription,
      }),
    ]
    const seed = moreLikeThisSeed(books, [FRENCH], TODAY)
    expect(seed.kind).toBe('more_like_this')
    expect(seed.title).toBe('Books like The Newer Book')
    expect(seed.languageCode).toBe('fr')
    expect(seed.query.split(' ').length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the seed language on the book (does not inject English)', () => {
    const seed = moreLikeThisSeed(
      [finished('a', { languageCode: 'de', finishedAt: '2026-06-20', description: richDescription })],
      [{ id: 'de', name: 'German' }],
      TODAY,
    )
    expect(seed.languageCode).toBe('de')
  })

  it('skips books whose description is too short to carry theme signal', () => {
    const seed = moreLikeThisSeed(
      [finished('a', { languageCode: 'fr', finishedAt: '2026-06-20', description: 'short' })],
      [FRENCH],
      TODAY,
    )
    expect(seed).toBeNull()
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
