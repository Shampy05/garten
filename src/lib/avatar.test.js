import { describe, it, expect } from 'vitest'
import { hashSeed, avatarParams, growthStage, BLOOMS, STAGES, STAGE_HOURS } from './avatar.js'

describe('hashSeed', () => {
  it('is deterministic for the same seed', () => {
    expect(hashSeed('abc-123')).toBe(hashSeed('abc-123'))
  })

  it('differs across nearby seeds', () => {
    const seeds = ['user-1', 'user-2', 'user-3', 'user-4']
    expect(new Set(seeds.map(hashSeed)).size).toBe(seeds.length)
  })

  it('always returns an unsigned 32-bit integer', () => {
    for (const s of ['', 'a', 'ζωή', 'f47ac10b-58cc-4372-a567-0e02b2c3d479']) {
      const h = hashSeed(s)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('tolerates null/undefined seeds', () => {
    expect(() => hashSeed(null)).not.toThrow()
    expect(hashSeed(undefined)).toBe(hashSeed(undefined))
  })
})

describe('avatarParams', () => {
  it('is stable: the same person looks the same everywhere', () => {
    expect(avatarParams('some-uuid')).toEqual(avatarParams('some-uuid'))
  })

  it('stays within its documented ranges', () => {
    for (let i = 0; i < 200; i++) {
      const p = avatarParams(`seed-${i}`)
      expect(BLOOMS).toContain(p.bloom)
      expect(p.petals).toBeGreaterThanOrEqual(5)
      expect(p.petals).toBeLessThanOrEqual(7)
      expect(p.tilt).toBeGreaterThanOrEqual(-6)
      expect(p.tilt).toBeLessThanOrEqual(6)
      expect([1, -1]).toContain(p.leafSide)
      expect(p.petalStretch).toBeGreaterThanOrEqual(0.92)
      expect(p.petalStretch).toBeLessThanOrEqual(1.08)
    }
  })

  it('uses the whole bloom palette across many seeds', () => {
    const seen = new Set()
    for (let i = 0; i < 100; i++) seen.add(avatarParams(`seed-${i}`).bloom.name)
    expect(seen.size).toBe(BLOOMS.length)
  })
})

describe('growthStage', () => {
  it('maps logged hours to the four stages', () => {
    expect(growthStage(0)).toBe('seedling')
    expect(growthStage(STAGE_HOURS.sprout - 0.1)).toBe('seedling')
    expect(growthStage(STAGE_HOURS.sprout)).toBe('sprout')
    expect(growthStage(STAGE_HOURS.bloom)).toBe('bloom')
    expect(growthStage(STAGE_HOURS.flourish)).toBe('flourish')
    expect(growthStage(10000)).toBe('flourish')
  })

  it('shows the fully-grown face when hours are unknown (friends)', () => {
    expect(growthStage(null)).toBe('bloom')
    expect(growthStage(undefined)).toBe('bloom')
  })

  it('only ever returns a known stage', () => {
    for (const h of [null, 0, 5, 25, 100, 999]) {
      expect(STAGES).toContain(growthStage(h))
    }
  })
})
