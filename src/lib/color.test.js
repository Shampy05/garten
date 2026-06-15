import { describe, it, expect } from 'vitest'
import { PALETTE, nextColor, colorDistance } from './color.js'

describe('color palette', () => {
  it('has no duplicate entries', () => {
    const lower = PALETTE.map(c => c.toLowerCase())
    expect(new Set(lower).size).toBe(PALETTE.length)
  })

  it('keeps every pair of palette colors visually distinct', () => {
    // Threshold chosen so the two-greens / two-reds collisions that motivated
    // this change would fail the test.
    const MIN_DISTANCE = 90
    for (let i = 0; i < PALETTE.length; i++) {
      for (let j = i + 1; j < PALETTE.length; j++) {
        const d = colorDistance(PALETTE[i], PALETTE[j])
        expect(d, `${PALETTE[i]} vs ${PALETTE[j]}`).toBeGreaterThan(MIN_DISTANCE)
      }
    }
  })
})

describe('colorDistance', () => {
  it('is zero for identical colors', () => {
    expect(colorDistance('#0072b2', '#0072b2')).toBe(0)
  })

  it('rates near-identical greens as closer than green vs blue', () => {
    const greens = colorDistance('#16a34a', '#65a30d') // the old collision
    const greenBlue = colorDistance('#16a34a', '#0072b2')
    expect(greens).toBeLessThan(greenBlue)
  })
})

describe('nextColor', () => {
  it('returns the first palette color for a fresh account', () => {
    expect(nextColor([])).toBe(PALETTE[0])
  })

  it('never returns a color already in use (until the palette is exhausted)', () => {
    const used = []
    for (let i = 0; i < PALETTE.length; i++) {
      const c = nextColor(used)
      expect(used).not.toContain(c)
      used.push(c)
    }
    // All palette colors assigned exactly once.
    expect(new Set(used.map(c => c.toLowerCase())).size).toBe(PALETTE.length)
  })

  it('picks a color far from the ones already chosen', () => {
    const picked = nextColor(['#0072b2']) // blue in use
    // The pick should be meaningfully distant from blue, not another blue.
    expect(colorDistance(picked, '#0072b2')).toBeGreaterThan(150)
  })

  it('maximizes the minimum distance across multiple used colors', () => {
    const used = ['#0072b2', '#d55e00'] // blue + vermillion
    const picked = nextColor(used)
    const minToUsed = Math.min(...used.map(u => colorDistance(picked, u)))
    // Any alternative unused color cannot beat the chosen one's min-distance.
    const usedSet = new Set(used.map(c => c.toLowerCase()))
    for (const cand of PALETTE.filter(c => !usedSet.has(c.toLowerCase()))) {
      const candMin = Math.min(...used.map(u => colorDistance(cand, u)))
      expect(minToUsed).toBeGreaterThanOrEqual(candMin)
    }
  })

  it('is case-insensitive about used colors', () => {
    const picked = nextColor(['#0072B2'])
    expect(picked.toLowerCase()).not.toBe('#0072b2')
  })

  it('falls back to a palette color when more languages than palette', () => {
    const used = [...PALETTE]
    const picked = nextColor(used)
    expect(PALETTE).toContain(picked)
  })
})
