import { describe, it, expect } from 'vitest'
import { normalizeVisionResponse } from './normalize.ts'
import fixture from '../../../src/lib/__fixtures__/visionPage.json'

describe('normalizeVisionResponse', () => {
  it('returns null when there is no fullTextAnnotation (blank/no-text image)', () => {
    expect(normalizeVisionResponse({ responses: [{}] })).toBeNull()
    expect(normalizeVisionResponse({})).toBeNull()
    expect(normalizeVisionResponse(null)).toBeNull()
  })

  it('extracts page dimensions', () => {
    const out = normalizeVisionResponse(fixture)
    expect(out.width).toBe(1600)
    expect(out.height).toBe(1200)
  })

  it('joins multi-symbol words across blocks/paragraphs', () => {
    const out = normalizeVisionResponse(fixture)
    const texts = out.words.map((w) => w.text)
    expect(texts).toContain('Der')
    expect(texts).toContain('Wald')
    expect(texts).toContain('flüsterte')
    expect(texts).toContain('Schritte')
    expect(out.words).toHaveLength(13)
  })

  it('defaults a missing vertex x/y coordinate to 0 (Vision omits zero values)', () => {
    const out = normalizeVisionResponse(fixture)
    const der = out.words.find((w) => w.text === 'Der')
    // First vertex has no "x" key in the fixture.
    expect(der.quad[0]).toBe(0)
    expect(der.quad[1]).toBe(100)
  })

  it('keeps punctuation-wrapped and pure-punctuation words as raw text (cleaning is the client lib\'s job)', () => {
    const out = normalizeVisionResponse(fixture)
    const texts = out.words.map((w) => w.text)
    expect(texts).toContain('»Wald«')
    expect(texts).toContain('.')
  })

  it('keeps numeric tokens as raw text (filtering is the client lib\'s job)', () => {
    const out = normalizeVisionResponse(fixture)
    expect(out.words.map((w) => w.text)).toContain('12')
  })

  it('produces an 8-number quad per word', () => {
    const out = normalizeVisionResponse(fixture)
    for (const w of out.words) {
      expect(w.quad).toHaveLength(8)
      expect(w.quad.every((n) => typeof n === 'number')).toBe(true)
    }
  })
})
