import { describe, it, expect } from 'vitest'
import {
  targetHours,
  hoursForLevel,
  levelForHours,
  forecastMonths,
  weightedWeeklyPace,
  paceMomentum,
  PACE_WINDOW_DAYS,
  DEFAULT_TARGET_HOURS,
} from './proficiency.js'

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
    expect(hoursForLevel('Spanish', 'b1')).toBe(Math.round(750 * 0.45))
    expect(hoursForLevel('Spanish', 'none')).toBe(0)
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
