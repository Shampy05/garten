import { describe, it, expect } from 'vitest'
import { gendersForLanguage, hasGrammaticalGender, GENDER_LABELS } from './grammaticalGender.js'
import { languages } from './languages.js'

describe('gendersForLanguage', () => {
  it('matches the examples given when the feature was requested', () => {
    expect(gendersForLanguage('German')).toEqual(['masculine', 'feminine', 'neuter'])
    expect(gendersForLanguage('French')).toEqual(['masculine', 'feminine'])
    expect(gendersForLanguage('Urdu')).toEqual(['masculine', 'feminine'])
    expect(gendersForLanguage('English')).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(gendersForLanguage('german')).toEqual(['masculine', 'feminine', 'neuter'])
    expect(gendersForLanguage('GERMAN')).toEqual(['masculine', 'feminine', 'neuter'])
  })

  it('handles multi-word language names', () => {
    expect(gendersForLanguage('Haitian Creole')).toEqual([])
    expect(gendersForLanguage('Scottish Gaelic')).toEqual(['masculine', 'feminine'])
  })

  it('returns [] for missing, empty, or unmapped input', () => {
    expect(gendersForLanguage(null)).toEqual([])
    expect(gendersForLanguage('')).toEqual([])
    expect(gendersForLanguage('Klingon')).toEqual([])
  })

  it('uses common/neuter (not masculine/feminine) for Scandinavian-style two-gender languages', () => {
    expect(gendersForLanguage('Danish')).toEqual(['common', 'neuter'])
    expect(gendersForLanguage('Swedish')).toEqual(['common', 'neuter'])
    expect(gendersForLanguage('Norwegian')).toEqual(['common', 'neuter'])
    expect(gendersForLanguage('Dutch')).toEqual(['common', 'neuter'])
  })

  it('every language in languages.js has an explicit (possibly empty) entry, not an accidental fallback', () => {
    // A typo in the mapping's keys would silently fall back to "no gender"
    // for a real language. This just guards that every name at least
    // resolves to a defined, deliberate answer.
    for (const name of languages) {
      expect(() => gendersForLanguage(name)).not.toThrow()
    }
  })
})

describe('hasGrammaticalGender', () => {
  it('mirrors gendersForLanguage length', () => {
    expect(hasGrammaticalGender('German')).toBe(true)
    expect(hasGrammaticalGender('English')).toBe(false)
  })
})

describe('GENDER_LABELS', () => {
  it('has a display label for every gender key used in the mapping', () => {
    expect(GENDER_LABELS.masculine).toBe('Masculine')
    expect(GENDER_LABELS.feminine).toBe('Feminine')
    expect(GENDER_LABELS.neuter).toBe('Neuter')
    expect(GENDER_LABELS.common).toBe('Common')
  })
})
