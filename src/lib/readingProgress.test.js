import { describe, it, expect } from 'vitest'
import { weightedPace, readingStreak, predictedFinish, pct } from './readingProgress.js'

describe('weightedPace', () => {
  it('returns 0 with no sessions', () => {
    expect(weightedPace([])).toBe(0)
  })

  it('returns the simple average for same-day sessions', () => {
    const today = new Date().toISOString().slice(0, 10)
    const sessions = [
      { date: today, pagesRead: 10 },
      { date: today, pagesRead: 20 },
    ]
    expect(weightedPace(sessions)).toBeCloseTo(15, 1)
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
    expect(weightedPace(sessions)).toBeGreaterThan(15)
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
