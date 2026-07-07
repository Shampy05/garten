import { describe, it, expect } from 'vitest'
import {
  reviewWord,
  isDue,
  dueWords,
  countDue,
  vocabGrowthStage,
  sessionSummary,
  SRS_INTERVALS,
  MAX_STAGE,
} from './srs.js'

const TODAY = '2026-07-07'

function word(overrides = {}) {
  return { stage: 0, dueDate: TODAY, lapses: 0, reviewCount: 0, ...overrides }
}

describe('reviewWord', () => {
  it('walks the full ladder with good grades', () => {
    let w = word()
    const expected = ['2026-07-08', '2026-07-10', '2026-07-14', '2026-07-21', '2026-08-06', '2026-10-05']
    for (let s = 1; s <= MAX_STAGE; s++) {
      const next = reviewWord(w, 'good', TODAY)
      expect(next.stage).toBe(s)
      expect(next.dueDate).toBe(expected[s - 1])
      w = { ...w, ...next }
    }
  })

  it('easy jumps two stages, capped at the top', () => {
    expect(reviewWord(word({ stage: 1 }), 'easy', TODAY).stage).toBe(3)
    expect(reviewWord(word({ stage: MAX_STAGE - 1 }), 'easy', TODAY).stage).toBe(MAX_STAGE)
    expect(reviewWord(word({ stage: MAX_STAGE }), 'good', TODAY).stage).toBe(MAX_STAGE)
  })

  it('again drops two stages, counts a lapse, and stays due today', () => {
    const fromTop = reviewWord(word({ stage: 6, lapses: 1 }), 'again', TODAY)
    expect(fromTop.stage).toBe(4)
    expect(fromTop.lapses).toBe(2)

    const fromBottom = reviewWord(word({ stage: 0 }), 'again', TODAY)
    expect(fromBottom.stage).toBe(0)
    expect(fromBottom.dueDate).toBe(TODAY) // recycles within the session
    expect(fromBottom.lapses).toBe(1)
  })

  it('stamps review bookkeeping', () => {
    const next = reviewWord(word({ reviewCount: 4 }), 'good', TODAY)
    expect(next.reviewCount).toBe(5)
    expect(next.lastReviewedAt).toBe(TODAY)
  })

  it('crosses month boundaries correctly', () => {
    // stage 3 → 4 is a 14-day interval: Jun 25 + 14 = Jul 9.
    expect(reviewWord(word({ stage: 3 }), 'good', '2026-06-25').dueDate).toBe('2026-07-09')
  })
})

describe('isDue / countDue / dueWords', () => {
  it('due means dueDate on or before today', () => {
    expect(isDue(word({ dueDate: '2026-07-01' }), TODAY)).toBe(true)
    expect(isDue(word({ dueDate: TODAY }), TODAY)).toBe(true)
    expect(isDue(word({ dueDate: '2026-07-08' }), TODAY)).toBe(false)
    expect(isDue({}, TODAY)).toBe(false)
  })

  it('counts only due words', () => {
    const words = [word(), word({ dueDate: '2026-08-01' }), word({ dueDate: '2026-06-01' })]
    expect(countDue(words, TODAY)).toBe(2)
  })

  it('orders a session most-overdue first, then shakiest stage', () => {
    const words = [
      word({ id: 'today-high', dueDate: TODAY, stage: 5 }),
      word({ id: 'today-low', dueDate: TODAY, stage: 1 }),
      word({ id: 'overdue', dueDate: '2026-06-20', stage: 6 }),
      word({ id: 'future', dueDate: '2026-09-01' }),
    ]
    expect(dueWords(words, TODAY).map((w) => w.id)).toEqual(['overdue', 'today-low', 'today-high'])
  })
})

describe('vocabGrowthStage', () => {
  it('maps SRS stages onto the growth arc', () => {
    expect(vocabGrowthStage(word({ stage: 0 }))).toBe('seed')
    expect(vocabGrowthStage(word({ stage: 1 }))).toBe('seed')
    expect(vocabGrowthStage(word({ stage: 2 }))).toBe('sprout')
    expect(vocabGrowthStage(word({ stage: 3 }))).toBe('sprout')
    expect(vocabGrowthStage(word({ stage: 4 }))).toBe('bloom')
    expect(vocabGrowthStage(word({ stage: 5 }))).toBe('bloom')
    expect(vocabGrowthStage(word({ stage: 6 }))).toBe('flourish')
  })
})

describe('sessionSummary', () => {
  it('tallies the grades', () => {
    expect(sessionSummary(['good', 'again', 'good', 'easy'])).toEqual({
      reviewed: 4,
      again: 1,
      good: 2,
      easy: 1,
    })
    expect(sessionSummary([])).toEqual({ reviewed: 0, again: 0, good: 0, easy: 0 })
  })
})

describe('SRS_INTERVALS invariants', () => {
  it('is monotonically increasing from a same-day stage 0', () => {
    expect(SRS_INTERVALS[0]).toBe(0)
    for (let i = 1; i < SRS_INTERVALS.length; i++) {
      expect(SRS_INTERVALS[i]).toBeGreaterThan(SRS_INTERVALS[i - 1])
    }
  })
})
