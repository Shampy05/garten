import { describe, it, expect } from 'vitest'
import {
  BOOK_LANGUAGES,
  CODE_SET,
  nameForCode,
  codeForName,
  isValidCode,
} from './bookLanguages.js'

describe('book languages', () => {
  it('every entry has a valid ISO 639-1 shaped code', () => {
    for (const lang of BOOK_LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2}$/)
      expect(typeof lang.name).toBe('string')
      expect(lang.name.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate codes', () => {
    expect(CODE_SET.size).toBe(BOOK_LANGUAGES.length)
  })

  it('nameForCode round-trips known codes', () => {
    expect(nameForCode('fr')).toBe('French')
    expect(nameForCode('ja')).toBe('Japanese')
  })

  it('nameForCode falls back to the upper-cased code for unknowns', () => {
    expect(nameForCode('xx')).toBe('XX')
    expect(nameForCode('')).toBe('')
  })

  it('codeForName maps Garten language names case-insensitively', () => {
    expect(codeForName('French')).toBe('fr')
    expect(codeForName('spanish')).toBe('es')
    expect(codeForName('Klingon')).toBeNull()
    expect(codeForName('')).toBeNull()
  })

  it('isValidCode reflects the curated set', () => {
    expect(isValidCode('de')).toBe(true)
    expect(isValidCode('zz')).toBe(false)
  })
})
