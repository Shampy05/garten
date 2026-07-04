import { describe, it, expect } from 'vitest'
import {
  mergeTimelineRows,
  groupRowsByDay,
  dayLanguageMix,
  weekStartFor,
  weekLabel,
  weekSummary,
} from './recentActivity.js'

const session = (id, date, languageId, hours = 1, minutes = 0, createdAt = date + 'T10:00:00Z') => ({
  id, date, languageId, type: 'reading', hours, minutes, createdAt, kind: 'session',
})
const reading = (id, date, createdAt = date + 'T10:00:00Z') => ({
  id, date, createdAt, kind: 'reading', bookTitle: 'Book ' + id, pagesRead: 10,
})

describe('mergeTimelineRows', () => {
  it('interleaves sessions and reading rows, newest first', () => {
    const merged = mergeTimelineRows(
      [session('s1', '2026-07-01', 'fr'), session('s2', '2026-07-03', 'fr')],
      [reading('r1', '2026-07-02')]
    )
    expect(merged.map((r) => r.id)).toEqual(['s2', 'r1', 's1'])
  })

  it('breaks same-day ties by createdAt', () => {
    const merged = mergeTimelineRows(
      [
        session('early', '2026-07-01', 'fr', 1, 0, '2026-07-01T08:00:00Z'),
        session('late', '2026-07-01', 'fr', 1, 0, '2026-07-01T18:00:00Z'),
      ],
      []
    )
    expect(merged.map((r) => r.id)).toEqual(['late', 'early'])
  })

  it('handles empty inputs', () => {
    expect(mergeTimelineRows([], [])).toEqual([])
  })
})

describe('groupRowsByDay', () => {
  it('buckets rows under their date, preserving row order', () => {
    const rows = mergeTimelineRows(
      [session('s1', '2026-07-02', 'fr'), session('s2', '2026-07-02', 'de')],
      [reading('r1', '2026-07-01')]
    )
    const groups = groupRowsByDay(rows)
    expect(groups.map((g) => g.date)).toEqual(['2026-07-02', '2026-07-01'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['s1', 's2'])
  })

  it('returns empty for no rows', () => {
    expect(groupRowsByDay([])).toEqual([])
  })
})

describe('dayLanguageMix', () => {
  const languages = [{ id: 'fr', name: 'French', color: '#1' }, { id: 'de', name: 'German', color: '#2' }]

  it('returns empty for a day with no minutes', () => {
    expect(dayLanguageMix([], languages)).toEqual([])
  })

  it('splits proportionally and sums to ~100', () => {
    const mix = dayLanguageMix(
      [session('a', '2026-07-01', 'fr', 1, 0), session('b', '2026-07-01', 'de', 1, 0)],
      languages
    )
    expect(mix).toHaveLength(2)
    const sum = mix.reduce((s, m) => s + m.percent, 0)
    expect(sum).toBeCloseTo(100, 5)
  })

  it('sorts the largest contributor first', () => {
    const mix = dayLanguageMix(
      [session('a', '2026-07-01', 'fr', 3, 0), session('b', '2026-07-01', 'de', 1, 0)],
      languages
    )
    expect(mix[0].name).toBe('French')
  })

  it('falls back to "Other" for an unknown language id', () => {
    const mix = dayLanguageMix([session('a', '2026-07-01', 'ghost', 1, 0)], languages)
    expect(mix[0].name).toBe('Other')
  })
})

describe('weekStartFor / weekLabel', () => {
  it('resolves the Monday of the containing week', () => {
    // 2026-07-01 is a Wednesday; that week's Monday is 2026-06-29.
    expect(weekStartFor('2026-07-01')).toBe('2026-06-29')
  })

  it('is stable for every day within the same week', () => {
    const days = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-05']
    const starts = new Set(days.map(weekStartFor))
    expect(starts.size).toBe(1)
  })

  it('formats a short label', () => {
    expect(weekLabel('2026-06-29')).toMatch(/Week of Jun 29/)
  })
})

describe('weekSummary', () => {
  const languages = [{ id: 'fr', name: 'French', color: '#1' }, { id: 'de', name: 'German', color: '#2' }]

  it('computes totals scoped to the week containing dateStr, from the full entries list', () => {
    const entries = [
      { date: '2026-06-29', languageId: 'fr', hours: 1, minutes: 0 }, // in week
      { date: '2026-07-02', languageId: 'fr', hours: 0, minutes: 30 }, // in week
      { date: '2026-07-06', languageId: 'de', hours: 2, minutes: 0 }, // next week
    ]
    const s = weekSummary(entries, languages, '2026-07-01')
    expect(s.totalMinutes).toBe(90)
    expect(s.activeDays).toBe(2)
    expect(s.topLanguageName).toBe('French')
    expect(s.weekStart).toBe('2026-06-29')
  })

  it('returns zeroed stats for a week with no entries', () => {
    const s = weekSummary([], languages, '2026-07-01')
    expect(s.totalMinutes).toBe(0)
    expect(s.activeDays).toBe(0)
    expect(s.topLanguageName).toBeNull()
  })
})
