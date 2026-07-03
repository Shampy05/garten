import { describe, it, expect } from 'vitest'
import { computeNextAction } from './nextAction.js'

const TODAY = '2026-07-03'
const daysBefore = (n) => {
  const d = new Date(TODAY + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const entry = (languageId, date, hours = 1, minutes = 0) => ({ languageId, date, hours, minutes })
const langs = [{ id: 'fr', name: 'French' }, { id: 'de', name: 'German' }]

describe('computeNextAction', () => {
  it('greets a brand-new gardener', () => {
    const a = computeNextAction({ entries: [], languages: langs, today: TODAY })
    expect(a.kind).toBe('first-seed')
  })

  it('warns when a live streak is unwatered today', () => {
    const entries = [entry('fr', daysBefore(1)), entry('fr', daysBefore(2)), entry('fr', daysBefore(3))]
    const a = computeNextAction({ entries, languages: langs, todayMinutes: 0, today: TODAY })
    expect(a.kind).toBe('streak-risk')
    expect(a.tone).toBe('urgent')
    expect(a.message).toContain('3-day streak')
  })

  it('does not warn about a streak once today is logged', () => {
    const entries = [entry('fr', TODAY), entry('fr', daysBefore(1)), entry('fr', daysBefore(2))]
    const a = computeNextAction({ entries, languages: langs, todayMinutes: 30, today: TODAY })
    expect(a.kind).not.toBe('streak-risk')
  })

  it('nudges when within reach of the weekly goal', () => {
    const entries = [entry('fr', TODAY)]
    const a = computeNextAction({
      entries, languages: langs, todayMinutes: 30,
      weekMinutes: 280, goalHours: 5, today: TODAY, // 300 target, 20 left
    })
    expect(a.kind).toBe('goal-cusp')
    expect(a.message).toContain('20m')
  })

  it('streak risk outranks the goal cusp', () => {
    const entries = [entry('fr', daysBefore(1)), entry('fr', daysBefore(2))]
    const a = computeNextAction({
      entries, languages: langs, todayMinutes: 0,
      weekMinutes: 280, goalHours: 5, today: TODAY,
    })
    expect(a.kind).toBe('streak-risk')
  })

  it('asks to plant today when nothing is logged and no streak is at stake', () => {
    const entries = [entry('fr', daysBefore(5))]
    const a = computeNextAction({ entries, languages: langs, todayMinutes: 0, today: TODAY })
    expect(a.kind).toBe('plant-today')
  })

  it('surfaces a lagging activity goal after today is handled', () => {
    const entries = [entry('fr', TODAY)]
    const a = computeNextAction({
      entries, languages: langs, todayMinutes: 20,
      activityRows: [{ type: 'reading', targetHours: 3, loggedMinutes: 60, progress: 33 }],
      today: TODAY,
    })
    expect(a.kind).toBe('activity-goal')
    expect(a.message).toContain('Reading')
    expect(a.message).toContain('2h') // 180 - 60 = 120m
  })

  it('flags a neglected language after a week of silence', () => {
    const entries = [entry('fr', TODAY), entry('de', daysBefore(9))]
    const a = computeNextAction({ entries, languages: langs, todayMinutes: 20, today: TODAY })
    expect(a.kind).toBe('neglected')
    expect(a.message).toContain('German')
    expect(a.message).toContain('9 days')
  })

  it('affirms a thriving garden when nothing needs attention', () => {
    const entries = [entry('fr', TODAY), entry('de', daysBefore(2))]
    const a = computeNextAction({
      entries, languages: langs, todayMinutes: 45,
      weekMinutes: 400, goalHours: 5, today: TODAY,
    })
    expect(a.kind).toBe('thriving')
    expect(a.tone).toBe('calm')
  })
})
