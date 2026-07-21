import { describe, it, expect } from 'vitest'
import { cleanToken, quadPoints, buildOcrCandidates, MIN_LEN, MAX_LEN } from './ocrWords.js'
import { normalizeVisionResponse } from '../../supabase/functions/ocr-page/normalize.ts'
import fixture from './__fixtures__/visionPage.json'

describe('cleanToken', () => {
  it('strips leading/trailing punctuation', () => {
    expect(cleanToken('»Wald«')).toBe('Wald')
    expect(cleanToken('"hello,"')).toBe('hello')
    expect(cleanToken('(word)')).toBe('word')
  })

  it('keeps internal apostrophes and hyphens', () => {
    expect(cleanToken("l'arbre")).toBe("l'arbre")
    expect(cleanToken('Groß-Stadt')).toBe('Groß-Stadt')
  })

  it('reduces pure punctuation to an empty string', () => {
    expect(cleanToken('.')).toBe('')
    expect(cleanToken('—')).toBe('')
  })
})

describe('quadPoints', () => {
  it('formats an 8-number quad as an SVG points string', () => {
    expect(quadPoints([0, 0, 10, 0, 10, 10, 0, 10])).toBe('0,0 10,0 10,10 0,10')
  })

  it('returns an empty string for a malformed quad', () => {
    expect(quadPoints(null)).toBe('')
    expect(quadPoints([1, 2])).toBe('')
  })
})

describe('buildOcrCandidates against a real (fixture) OCR payload', () => {
  const payload = normalizeVisionResponse(fixture)

  it('carries through width/height', () => {
    const out = buildOcrCandidates(payload)
    expect(out.width).toBe(1600)
    expect(out.height).toBe(1200)
  })

  it('skips numeric tokens and pure-punctuation tokens', () => {
    const out = buildOcrCandidates(payload)
    const twelve = out.tokens.find((t) => t.raw === '12')
    const dot = out.tokens.find((t) => t.raw === '.')
    expect(twelve.status).toBe('skipped')
    expect(dot.status).toBe('skipped')
    expect(out.terms.some((t) => t.lower === '12')).toBe(false)
  })

  it('cleans punctuation-wrapped tokens and dedupes them against the plain form', () => {
    const out = buildOcrCandidates(payload, { languageCode: 'de' })
    const guillemets = out.tokens.find((t) => t.raw === '»Wald«')
    expect(guillemets.term).toBe('Wald')
    expect(guillemets.status).toBe('candidate')
    // "Wald" appears twice in the fixture (plain + guillemet-wrapped) — one
    // selectable term, not two.
    const waldTerms = out.terms.filter((t) => t.lower === 'wald')
    expect(waldTerms).toHaveLength(1)
  })

  it('tags already-planted terms as muted/un-tappable and excludes them from terms', () => {
    const out = buildOcrCandidates(payload, { plantedTerms: ['wald'], languageCode: 'de' })
    const waldTokens = out.tokens.filter((t) => t.lower === 'wald')
    expect(waldTokens.every((t) => t.status === 'planted')).toBe(true)
    expect(out.terms.some((t) => t.lower === 'wald')).toBe(false)
  })

  it('tags German stopwords but keeps them tappable (in tokens, not in terms is wrong — check both)', () => {
    const out = buildOcrCandidates(payload, { languageCode: 'de' })
    // "und" is a German stopword.
    const und = out.tokens.find((t) => t.lower === 'und')
    expect(und.status).toBe('candidate')
    expect(und.stopword).toBe(true)
    // Stopwords still appear in `terms` (tappable on the photo); callers
    // that render the chip fallback list filter them out themselves.
    expect(out.terms.some((t) => t.lower === 'und')).toBe(true)
  })

  it('does not tag non-stopwords', () => {
    const out = buildOcrCandidates(payload, { languageCode: 'de' })
    const wald = out.terms.find((t) => t.lower === 'wald')
    expect(wald.stopword).toBe(false)
  })

  it('falls back to no stopword tagging for a language with no curated list', () => {
    const out = buildOcrCandidates(payload, { languageCode: 'xx' })
    expect(out.terms.every((t) => t.stopword === false)).toBe(true)
  })

  it('preserves reading order in terms (first occurrence wins)', () => {
    const out = buildOcrCandidates(payload, { languageCode: 'de' })
    const order = out.terms.map((t) => t.lower)
    expect(order.indexOf('der')).toBeLessThan(order.indexOf('wald'))
    expect(order.indexOf('wald')).toBeLessThan(order.indexOf('war'))
  })

  it('respects the length guard', () => {
    const out = buildOcrCandidates({ width: 1, height: 1, words: [{ text: 'ab', quad: [0, 0, 0, 0, 0, 0, 0, 0] }] })
    expect(out.tokens[0].status).toBe('skipped')
    const longWord = 'a'.repeat(MAX_LEN + 1)
    const out2 = buildOcrCandidates({ width: 1, height: 1, words: [{ text: longWord, quad: [0, 0, 0, 0, 0, 0, 0, 0] }] })
    expect(out2.tokens[0].status).toBe('skipped')
    expect(MIN_LEN).toBeGreaterThan(0)
  })

  it('handles an empty/missing payload gracefully', () => {
    expect(buildOcrCandidates(null)).toEqual({ width: 0, height: 0, tokens: [], terms: [] })
    expect(buildOcrCandidates({})).toEqual({ width: 0, height: 0, tokens: [], terms: [] })
  })
})
