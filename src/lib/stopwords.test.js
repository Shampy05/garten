import { describe, it, expect } from 'vitest'
import { hasStopwords, stopwordsFor } from './stopwords.js'

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
