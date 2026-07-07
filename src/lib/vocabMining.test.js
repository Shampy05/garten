import { describe, it, expect } from 'vitest'
import { mineCandidates, mineNewWords, MIN_LEN, MAX_LEN } from './vocabMining.js'
import { hasStopwords, stopwordsFor } from './stopwords.js'

describe('mineCandidates', () => {
  it('returns unique tokens in first-occurrence order', () => {
    const { candidates } = mineCandidates('The garden grew, and the garden bloomed.')
    expect(candidates[0]).toBe('The')
    expect(candidates).toContain('grew')
    expect(candidates).toContain('and')
    expect(candidates).toContain('bloomed')
    // Dedup is case-insensitive — "garden" only appears once.
    expect(candidates.filter((t) => t.toLowerCase() === 'garden')).toHaveLength(1)
  })

  it('skips tokens shorter than MIN_LEN or longer than MAX_LEN', () => {
    const long = 'a'.repeat(MAX_LEN + 1)
    const { candidates, skipped } = mineCandidates(`cat dog ${long} tree`)
    expect(candidates.map((c) => c.toLowerCase()).sort()).toEqual(['cat', 'dog', 'tree'])
    expect(skipped.length).toContain(long)
  })

  it('keeps letter-only segments of digit-bearing tokens, drops the short ones', () => {
    // \p{L} splits on digits, so "123hello" yields "hello" (kept, valid length)
    // and "p2a" yields ["p", "a"] (both too short → length skip).
    const { candidates, skipped } = mineCandidates('apple p2a 123hello banana')
    expect(candidates.map((c) => c.toLowerCase()).sort()).toEqual(['apple', 'banana', 'hello'])
    expect(skipped.length).toContain('p')
    expect(skipped.length).toContain('a')
  })

  it('applies the English stopword list by default when languageCode is "en"', () => {
    const { candidates, skipped } = mineCandidates(
      'The boy ran quickly through the garden and over the wall.',
      { languageCode: 'en' },
    )
    const lower = candidates.map((c) => c.toLowerCase())
    expect(lower).not.toContain('the')
    expect(lower).not.toContain('and')
    expect(lower).not.toContain('over')
    expect(lower).not.toContain('through')
    expect(lower).toEqual(['boy', 'ran', 'quickly', 'garden', 'wall'])
    expect(skipped.stopword.length).toBeGreaterThan(0)
  })

  it('falls back to no stopword filtering for unsupported languages', () => {
    // Japanese ('ja') isn't in stopwords.js — but our \p{L} regex would
    // keep running the whole CJK string as one token in either case.
    // Use a Latin-script language without a stopword list instead.
    const { candidates, skipped } = mineCandidates('hola mundo bonito dia', {
      languageCode: 'eo', // Esperanto — not in our stopword map
    })
    expect(candidates.map((c) => c.toLowerCase()).sort()).toEqual(['bonito', 'dia', 'hola', 'mundo'])
    expect(skipped.stopword).toEqual([])
  })

  it('marks already-planted terms and excludes them from candidates', () => {
    const { candidates, skipped } = mineCandidates('The garden grew and bloomed', {
      plantedTerms: ['garden', 'BLOOMED'],
    })
    const lower = candidates.map((c) => c.toLowerCase())
    expect(lower).not.toContain('garden')
    expect(lower).not.toContain('bloomed')
    expect(skipped.planted.map((t) => t.toLowerCase()).sort()).toEqual(['bloomed', 'garden'])
  })

  it('preserves accented and non-Latin tokens', () => {
    const { candidates } = mineCandidates('café résumé naïve über', { languageCode: 'fr' })
    expect(candidates).toContain('café')
    expect(candidates).toContain('résumé')
    expect(candidates).toContain('naïve')
    expect(candidates).toContain('über')
  })

  it('preserves elided apostrophe forms intact', () => {
    // "l'arbre" survives as one token so the user can decide whether to plant
    // it as the article-noun compound or trim it themselves.
    const { candidates } = mineCandidates("l'arbre est grand")
    expect(candidates).toContain("l'arbre")
    expect(candidates).toContain('est')
    expect(candidates).toContain('grand')
  })

  it('handles an empty passage', () => {
    const { candidates, skipped } = mineCandidates('')
    expect(candidates).toEqual([])
    expect(skipped.planted).toEqual([])
    expect(skipped.stopword).toEqual([])
    expect(skipped.length).toEqual([])
  })
})

describe('mineNewWords', () => {
  it('returns just the candidate array', () => {
    expect(mineNewWords('the cat sat', { languageCode: 'en' })).toEqual(['cat', 'sat'])
  })
})

describe('stopwords', () => {
  it('reports coverage honestly', () => {
    expect(hasStopwords('en')).toBe(true)
    expect(hasStopwords('EN')).toBe(true)
    expect(hasStopwords('xx')).toBe(false)
    expect(hasStopwords(null)).toBe(false)
  })

  it('returns the live Set for a covered language', () => {
    expect(stopwordsFor('de') instanceof Set).toBe(true)
    expect(stopwordsFor('de').has('der')).toBe(true)
    expect(stopwordsFor('eo')).toBeNull()
  })
})