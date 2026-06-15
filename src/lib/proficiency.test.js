import { describe, it, expect } from 'vitest'
import {
  targetHours,
  hoursForLevel,
  levelForHours,
  forecastMonths,
  masteryHours,
  MASTERY_FACTOR,
  weightedWeeklyPace,
  paceMomentum,
  relationRank,
  nativeMultiplier,
  LEVELS,
  PACE_WINDOW_DAYS,
  DEFAULT_TARGET_HOURS,
} from './proficiency.js'

const fractionOf = (key) => LEVELS.find((l) => l.key === key).fraction

describe('targets', () => {
  it('falls back to the Category III default for unlisted languages', () => {
    expect(targetHours('Bengali')).toBe(DEFAULT_TARGET_HOURS)
  })

  it('uses FSI overrides where defined', () => {
    expect(targetHours('Spanish')).toBe(750)
    expect(targetHours('Japanese')).toBe(2200)
  })
})

describe('level <-> hours', () => {
  it('maps a level to a fraction of the target', () => {
    expect(hoursForLevel('Spanish', 'b1')).toBe(Math.round(750 * fractionOf('b1')))
    expect(hoursForLevel('Spanish', 'none')).toBe(0)
  })

  it('uses Cambridge-derived CEFR fractions', () => {
    expect(fractionOf('a1')).toBe(0.13)
    expect(fractionOf('a2')).toBe(0.25)
    expect(fractionOf('b1')).toBe(0.5)
    expect(fractionOf('b2')).toBe(0.73)
    expect(fractionOf('c1')).toBe(1.0)
  })

  it('keeps CEFR fractions monotonic and within [0, 1]', () => {
    const fr = LEVELS.map((l) => l.fraction)
    for (let i = 1; i < fr.length; i++) expect(fr[i]).toBeGreaterThan(fr[i - 1])
    expect(fr[0]).toBe(0)
    expect(fr[fr.length - 1]).toBe(1.0)
  })

  it('round-trips through the nearest level', () => {
    const h = hoursForLevel('German', 'b1')
    expect(levelForHours('German', h)).toBe('b1')
  })

  it('treats zero / missing prior hours as "none"', () => {
    expect(levelForHours('German', 0)).toBe('none')
    expect(levelForHours('German', undefined)).toBe('none')
  })
})

describe('masteryHours', () => {
  it('is a stretch above the base target, on the 25h grid', () => {
    const base = targetHours('Spanish') // 750
    const mastery = masteryHours('Spanish')
    expect(mastery).toBeGreaterThan(base)
    expect(mastery).toBe(Math.round((base * MASTERY_FACTOR) / 25) * 25)
    expect(mastery % 25).toBe(0)
  })

  it('respects the native-language adjustment', () => {
    expect(masteryHours('Portuguese', 'Spanish')).toBeLessThan(masteryHours('Portuguese'))
  })
})

describe('relationRank', () => {
  it('ranks a mutually-intelligible cluster highest', () => {
    expect(relationRank('Spanish', 'Portuguese')).toBe(5)
    expect(relationRank('Czech', 'Slovak')).toBe(5)
    expect(relationRank('Hindi', 'Urdu')).toBe(5)
  })

  it('ranks same sub-branch above same branch above same family', () => {
    expect(relationRank('German', 'Dutch')).toBe(4) // Continental West Germanic
    expect(relationRank('English', 'Dutch')).toBe(3) // both Germanic
    expect(relationRank('English', 'Spanish')).toBe(2) // both Indo-European
  })

  it('returns 1 for unrelated or untagged languages', () => {
    expect(relationRank('English', 'Japanese')).toBe(1)
    expect(relationRank('Spanish', 'Swahili')).toBe(1)
  })

  it('uses areal overrides for contact pairs', () => {
    expect(relationRank('Japanese', 'Korean')).toBe(4)
    expect(relationRank('Chinese', 'Japanese')).toBe(3)
  })
})

describe('nativeMultiplier', () => {
  it('is a no-op for an English L1 (backwards compatible)', () => {
    expect(nativeMultiplier('English', 'Spanish')).toBe(1)
    expect(nativeMultiplier(null, 'Spanish')).toBe(1)
  })

  it('discounts when the L1 is closer to the target than English is', () => {
    // Spanish->Portuguese: rank 5 vs English's rank 2 -> gap 3
    expect(nativeMultiplier('Spanish', 'Portuguese')).toBe(0.45)
    // Japanese->Korean: areal rank 4 vs English's rank 1 -> gap 3
    expect(nativeMultiplier('Japanese', 'Korean')).toBe(0.45)
  })

  it('never discounts when the L1 is no closer than English', () => {
    // Russian and English are both just "Indo-European" to French
    expect(nativeMultiplier('Russian', 'French')).toBe(1)
  })
})

describe('targetHours with native language', () => {
  it('is unchanged for English speakers', () => {
    expect(targetHours('Spanish')).toBe(750)
    expect(targetHours('Spanish', 'English')).toBe(750)
  })

  it('lowers the target for a closely-related L1, never raises it', () => {
    const adjusted = targetHours('Portuguese', 'Spanish')
    expect(adjusted).toBeLessThan(750)
    expect(adjusted).toBe(Math.round((750 * 0.45) / 25) * 25)
  })
})

describe('forecastMonths', () => {
  it('returns 0 when the target is already reached', () => {
    expect(forecastMonths(0, 5)).toBe(0)
  })

  it('returns null without a pace to extrapolate from', () => {
    expect(forecastMonths(100, 0)).toBeNull()
    expect(forecastMonths(100, null)).toBeNull()
  })

  it('divides remaining hours by weekly pace into months', () => {
    // 100h remaining at 5h/week = 20 weeks ≈ 4.6 months
    expect(forecastMonths(100, 5)).toBeCloseTo(20 / 4.345, 5)
  })
})

describe('weightedWeeklyPace', () => {
  it('is zero with no logged minutes', () => {
    expect(weightedWeeklyPace([])).toBe(0)
  })

  it('recovers a constant daily habit exactly', () => {
    // 30 min every day across the whole window -> 30*7/60 = 3.5 h/week
    const daily = new Array(PACE_WINDOW_DAYS).fill(30)
    expect(weightedWeeklyPace(daily)).toBeCloseTo(3.5, 6)
  })

  it('weights a recent session more heavily than an old one', () => {
    const recent = new Array(PACE_WINDOW_DAYS).fill(0)
    recent[0] = 60 // today
    const old = new Array(PACE_WINDOW_DAYS).fill(0)
    old[50] = 60 // ~7 weeks ago
    expect(weightedWeeklyPace(recent)).toBeGreaterThan(weightedWeeklyPace(old))
  })
})

describe('paceMomentum', () => {
  it('returns null without a prior-period baseline', () => {
    const onlyRecent = new Array(PACE_WINDOW_DAYS).fill(0)
    onlyRecent[5] = 100
    expect(paceMomentum(onlyRecent)).toBeNull()
  })

  it('is positive when the recent 4 weeks outpace the prior 4', () => {
    const d = new Array(PACE_WINDOW_DAYS).fill(0)
    d[5] = 200 // recent half (age < 28)
    d[35] = 100 // prior half
    expect(paceMomentum(d)).toBeCloseTo(1.0, 6) // (200-100)/100
  })

  it('is negative when winding down', () => {
    const d = new Array(PACE_WINDOW_DAYS).fill(0)
    d[5] = 50
    d[35] = 100
    expect(paceMomentum(d)).toBeCloseTo(-0.5, 6)
  })
})
