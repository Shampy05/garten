import { describe, it, expect } from 'vitest'
import { WORD_TYPES, WORD_TYPE_LABELS, isNounlike } from './wordType.js'

describe('WORD_TYPES / WORD_TYPE_LABELS', () => {
  it('has a label for every type', () => {
    for (const t of WORD_TYPES) {
      expect(WORD_TYPE_LABELS[t]).toBeTruthy()
    }
  })
})

describe('isNounlike', () => {
  it('is true for noun and for unset', () => {
    expect(isNounlike('noun')).toBe(true)
    expect(isNounlike(null)).toBe(true)
    expect(isNounlike(undefined)).toBe(true)
    expect(isNounlike('')).toBe(true)
  })

  it('is false for every other word type', () => {
    expect(isNounlike('verb')).toBe(false)
    expect(isNounlike('adjective')).toBe(false)
    expect(isNounlike('adverb')).toBe(false)
    expect(isNounlike('phrase')).toBe(false)
    expect(isNounlike('other')).toBe(false)
  })
})
