import { describe, it, expect } from 'vitest'
import { PALETTE, nextColor, colorDistance, hueGap, hueOf } from './color.js'

// Local WCAG contrast-vs-white helper (color.js doesn't need to export this).
function contrastVsWhite(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
  return 1.05 / (L + 0.05)
}

describe('palette', () => {
  it('has 10 unique colors', () => {
    expect(PALETTE).toHaveLength(10)
    expect(new Set(PALETTE.map(c => c.toLowerCase())).size).toBe(10)
  })

  it('is legible: every color clears 3:1 contrast on white', () => {
    for (const c of PALETTE) {
      expect(contrastVsWhite(c), c).toBeGreaterThanOrEqual(3)
    }
  })

  it('spreads its colors around the hue wheel (no near-duplicate hues)', () => {
    for (let i = 0; i < PALETTE.length; i++) {
      for (let j = i + 1; j < PALETTE.length; j++) {
        expect(hueGap(PALETTE[i], PALETTE[j]), `${PALETTE[i]} vs ${PALETTE[j]}`).toBeGreaterThan(15)
      }
    }
  })
})

describe('colorDistance (colorblind-aware)', () => {
  it('is zero for identical colors', () => {
    expect(colorDistance('#2563eb', '#2563eb')).toBe(0)
  })

  it('keeps every palette pair distinguishable under color blindness', () => {
    // Above the old red/rose collision (~33); the gamut won't allow much more
    // than this for ten colors.
    for (let i = 0; i < PALETTE.length; i++) {
      for (let j = i + 1; j < PALETTE.length; j++) {
        expect(colorDistance(PALETTE[i], PALETTE[j]), `${PALETTE[i]} vs ${PALETTE[j]}`).toBeGreaterThan(30)
      }
    }
  })
})

describe('hueGap', () => {
  it('is zero for the same hue and ~180 for opposites', () => {
    expect(hueGap('#16a34a', '#16a34a')).toBe(0)
    expect(hueGap('#ff0000', '#00ffff')).toBeCloseTo(180, 0)
  })
})

describe('nextColor', () => {
  it('returns the first palette color for a fresh account', () => {
    expect(nextColor([])).toBe(PALETTE[0])
  })

  it('never reuses a color until the palette is exhausted', () => {
    const used = []
    for (let i = 0; i < PALETTE.length; i++) {
      const c = nextColor(used)
      expect(used).not.toContain(c)
      used.push(c)
    }
    expect(new Set(used.map(c => c.toLowerCase())).size).toBe(PALETTE.length)
  })

  it('does not pick a second green when a green is already used', () => {
    const picked = nextColor(['#16a34a']) // green in use
    expect(hueGap(picked, '#16a34a')).toBeGreaterThan(40)
  })

  it('does not pick a second blue when a blue is already used', () => {
    const picked = nextColor(['#2563eb'])
    expect(hueGap(picked, '#2563eb')).toBeGreaterThan(40)
  })

  it('spreads picks around the hue wheel for several languages', () => {
    const used = []
    for (let i = 0; i < 6; i++) used.push(nextColor(used))
    let minGap = 360
    for (let i = 0; i < used.length; i++) {
      for (let j = i + 1; j < used.length; j++) {
        minGap = Math.min(minGap, hueGap(used[i], used[j]))
      }
    }
    expect(minGap).toBeGreaterThan(30)
  })

  it('is case-insensitive about used colors', () => {
    const picked = nextColor(['#2563EB'])
    expect(picked.toLowerCase()).not.toBe('#2563eb')
  })

  it('falls back to a palette color when there are more languages than colors', () => {
    const picked = nextColor([...PALETTE])
    expect(PALETTE).toContain(picked)
  })
})
