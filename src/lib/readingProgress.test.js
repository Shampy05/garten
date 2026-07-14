import { describe, it, expect } from 'vitest'
import { weightedPace, readingStreak, predictedFinish, pct, lastReadDaysAgo, formatPace, bookPaceStats } from './readingProgress.js'

describe('weightedPace', () => {
  it('returns 0 with no sessions', () => {
    expect(weightedPace([])).toBe(0)
  })

  it('sums same-day sessions rather than averaging them', () => {
    // Two sessions logged on the same day (e.g. a morning + evening read)
    // are 30 pages of real progress that day, not a "15 pages/session" rate.
    const today = new Date().toISOString().slice(0, 10)
    const sessions = [
      { date: today, pagesRead: 10 },
      { date: today, pagesRead: 20 },
    ]
    const soloDay = weightedPace([{ date: today, pagesRead: 30 }])
    expect(weightedPace(sessions)).toBeCloseTo(soloDay, 5)
  })

  it('weights recent sessions more heavily', () => {
    const d = new Date()
    const today = d.toISOString().slice(0, 10)
    d.setDate(d.getDate() - 14)
    const twoWeeksAgo = d.toISOString().slice(0, 10)
    const sessions = [
      { date: today, pagesRead: 20 },
      { date: twoWeeksAgo, pagesRead: 10 },
    ]
    // A day-bucketed average over the whole window, not per-session — so a
    // single 20-page day pulls the average well below 20, not above 15.
    const pace = weightedPace(sessions)
    expect(pace).toBeGreaterThan(0)
    expect(pace).toBeLessThan(20)
  })

  it('does not inflate pace when one big session is surrounded by off-days', () => {
    // Reading 60 pages once a week is a real pace of ~8.6 pages/day, not 60 —
    // the old per-session average conflated "session size" with "daily pace".
    const dateStrDaysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const sessions = [0, 7, 14, 21].map((n) => ({ date: dateStrDaysAgo(n), pagesRead: 60 }))
    const pace = weightedPace(sessions)
    expect(pace).toBeGreaterThan(5)
    expect(pace).toBeLessThan(20)
  })
})

describe('readingStreak', () => {
  it('returns 0 with no sessions', () => {
    expect(readingStreak([])).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    const d = new Date()
    const sessions = [
      { date: d.toISOString().slice(0, 10), pagesRead: 5 },
    ]
    d.setDate(d.getDate() - 1)
    sessions.push({ date: d.toISOString().slice(0, 10), pagesRead: 5 })
    expect(readingStreak(sessions)).toBe(2)
  })

  it('returns 0 when the last session was before yesterday', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    expect(readingStreak([{ date: d.toISOString().slice(0, 10), pagesRead: 5 }])).toBe(0)
  })
})

describe('predictedFinish', () => {
  it('returns null when already finished', () => {
    expect(predictedFinish(300, 300, 10)).toBeNull()
  })

  it('returns null when pace is zero', () => {
    expect(predictedFinish(50, 300, 0)).toBeNull()
  })

  it('predicts a future date', () => {
    const finish = predictedFinish(100, 300, 50)
    expect(finish).toBeInstanceOf(Date)
    expect(finish.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('pct', () => {
  it('returns 0 when total pages is unknown', () => {
    expect(pct(10, 0)).toBe(0)
  })

  it('caps at 100', () => {
    expect(pct(150, 100)).toBe(100)
  })

  it('rounds to the nearest integer', () => {
    expect(pct(25, 100)).toBe(25)
    expect(pct(1, 3)).toBe(33)
  })
})

function dateStrDaysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

describe('lastReadDaysAgo', () => {
  it('returns null with no sessions', () => {
    expect(lastReadDaysAgo([])).toBeNull()
  })

  it('returns 0 for a session today', () => {
    expect(lastReadDaysAgo([{ date: dateStrDaysAgo(0), pagesRead: 5 }])).toBe(0)
  })

  it('returns N for a session N days ago', () => {
    expect(lastReadDaysAgo([{ date: dateStrDaysAgo(4), pagesRead: 5 }])).toBe(4)
  })

  it('picks the most recent of several sessions regardless of order', () => {
    const sessions = [
      { date: dateStrDaysAgo(9), pagesRead: 5 },
      { date: dateStrDaysAgo(2), pagesRead: 5 },
      { date: dateStrDaysAgo(6), pagesRead: 5 },
    ]
    expect(lastReadDaysAgo(sessions)).toBe(2)
  })

  it('ignores rows with a missing date', () => {
    const sessions = [
      { date: null, pagesRead: 5 },
      { date: dateStrDaysAgo(3), pagesRead: 5 },
    ]
    expect(lastReadDaysAgo(sessions)).toBe(3)
  })
})

describe('formatPace', () => {
  it('returns empty string for zero or negative pace', () => {
    expect(formatPace(0)).toBe('')
    expect(formatPace(-2)).toBe('')
  })

  it('shows <1 for a pace that rounds to zero', () => {
    expect(formatPace(0.3)).toBe('<1 page/day')
  })

  it('uses the singular at one page per day', () => {
    expect(formatPace(1.2)).toBe('~1 page/day')
  })

  it('rounds and pluralises', () => {
    expect(formatPace(12.4)).toBe('~12 pages/day')
  })
})

describe('bookPaceStats', () => {
  it('handles a missing total page count', () => {
    const stats = bookPaceStats([{ date: dateStrDaysAgo(0), pagesRead: 10 }], { currentPage: 10, totalPages: null })
    expect(stats.pctRead).toBe(0)
    expect(stats.pagesLeft).toBeNull()
    expect(stats.finishDate).toBeNull()
  })

  it('computes pace, pages left and a future finish for an active book', () => {
    const stats = bookPaceStats([{ date: dateStrDaysAgo(0), pagesRead: 10 }], { currentPage: 50, totalPages: 100 })
    expect(stats.pace).toBeGreaterThan(0)
    expect(stats.hasSessions).toBe(true)
    expect(stats.pagesLeft).toBe(50)
    expect(stats.pctRead).toBe(50)
    expect(stats.finishDate).toBeInstanceOf(Date)
    expect(stats.finishDate.getTime()).toBeGreaterThan(Date.now())
  })

  it('reports no pace and no sessions when nothing is logged', () => {
    const stats = bookPaceStats([], { currentPage: 0, totalPages: 200 })
    expect(stats.pace).toBe(0)
    expect(stats.hasSessions).toBe(false)
    expect(stats.finishDate).toBeNull()
    expect(stats.lastReadDaysAgo).toBeNull()
  })

  it('distinguishes stale history: zero pace but hasSessions true', () => {
    const stats = bookPaceStats([{ date: dateStrDaysAgo(40), pagesRead: 10 }], { currentPage: 30, totalPages: 200 })
    expect(stats.pace).toBe(0)
    expect(stats.hasSessions).toBe(true)
    expect(stats.lastReadDaysAgo).toBe(40)
  })

  it('does not throw on a null record', () => {
    const stats = bookPaceStats([], null)
    expect(stats.pctRead).toBe(0)
    expect(stats.pagesLeft).toBeNull()
  })
})
