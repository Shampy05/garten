import { describe, it, expect } from 'vitest'
import {
  reviewWord,
  isDue,
  dueWords,
  countDue,
  vocabGrowthStage,
  sessionSummary,
  rediscoverPick,
  daysUntilDue,
  intervalProgress,
  wordDeck,
  REDISCOVER_MIN_STAGE,
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
    // Regression: dueDate must be today regardless of the landing stage —
    // a word dropping to stage 4 must NOT ride out stage 4's 14-day
    // interval, or "Again" barely differs from "Good" for advanced words.
    expect(fromTop.dueDate).toBe(TODAY)

    const fromBottom = reviewWord(word({ stage: 0 }), 'again', TODAY)
    expect(fromBottom.stage).toBe(0)
    expect(fromBottom.dueDate).toBe(TODAY) // recycles within the session
    expect(fromBottom.lapses).toBe(1)

    const fromMiddle = reviewWord(word({ stage: 3 }), 'again', TODAY)
    expect(fromMiddle.stage).toBe(1)
    expect(fromMiddle.dueDate).toBe(TODAY)
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

describe('daysUntilDue', () => {
  it('returns null when there is no dueDate', () => {
    expect(daysUntilDue({}, TODAY)).toBeNull()
  })

  it('returns a positive count for a future due date', () => {
    expect(daysUntilDue(word({ dueDate: '2026-07-21' }), TODAY)).toBe(14)
  })

  it('returns zero or negative for today/overdue', () => {
    expect(daysUntilDue(word({ dueDate: TODAY }), TODAY)).toBe(0)
    expect(daysUntilDue(word({ dueDate: '2026-07-01' }), TODAY)).toBe(-6)
  })
})

describe('intervalProgress', () => {
  it('returns null without a lastReviewedAt or dueDate', () => {
    expect(intervalProgress(word({ lastReviewedAt: null, dueDate: '2026-07-14' }), TODAY)).toBeNull()
    expect(intervalProgress(word({ lastReviewedAt: '2026-07-01', dueDate: null }), TODAY)).toBeNull()
  })

  it('computes position within the span from last review to due date', () => {
    // 2026-07-01 -> 2026-07-15 is a 14-day span; today (07-07) is 6 days in.
    const w = word({ lastReviewedAt: '2026-07-01', dueDate: '2026-07-15' })
    expect(intervalProgress(w, TODAY)).toBeCloseTo((6 / 14) * 100)
  })

  it('clamps to 0 and 100 at the span edges', () => {
    const notStarted = word({ lastReviewedAt: TODAY, dueDate: '2026-07-15' })
    expect(intervalProgress(notStarted, TODAY)).toBe(0)
    const overdueSpan = word({ lastReviewedAt: '2026-06-01', dueDate: '2026-07-01' })
    expect(intervalProgress(overdueSpan, TODAY)).toBe(100)
  })

  it('treats a same-day span (right after an again) as fully elapsed', () => {
    const w = word({ lastReviewedAt: TODAY, dueDate: TODAY })
    expect(intervalProgress(w, TODAY)).toBe(100)
  })
})

describe('wordDeck', () => {
  it('buckets a never-graded word as new, even though it is also due today', () => {
    const fresh = word({ stage: 0, dueDate: TODAY, reviewCount: 0 })
    expect(wordDeck(fresh, TODAY)).toBe('new')
    expect(isDue(fresh, TODAY)).toBe(true) // the state that made the old bucketing unreachable
  })

  it('buckets a reviewed word that is due again as due, not new', () => {
    const returning = word({ stage: 3, dueDate: TODAY, reviewCount: 4 })
    expect(wordDeck(returning, TODAY)).toBe('due')
  })

  it('buckets a reviewed word resting on its interval as mature', () => {
    const resting = word({ stage: 3, dueDate: '2026-07-21', reviewCount: 4 })
    expect(wordDeck(resting, TODAY)).toBe('mature')
  })

  it('a word that lapsed back to stage 0 is due, not new — reviewCount is what matters, not stage', () => {
    const lapsed = word({ stage: 0, dueDate: TODAY, reviewCount: 2 })
    expect(wordDeck(lapsed, TODAY)).toBe('due')
  })

  it('is exhaustive and disjoint: every word lands in exactly one deck', () => {
    const sample = [
      word({ stage: 0, dueDate: TODAY, reviewCount: 0 }),
      word({ stage: 0, dueDate: TODAY, reviewCount: 1 }),
      word({ stage: 1, dueDate: TODAY, reviewCount: 1 }),
      word({ stage: 2, dueDate: '2026-07-10', reviewCount: 2 }),
      word({ stage: 6, dueDate: '2026-10-01', reviewCount: 9 }),
    ]
    for (const w of sample) {
      expect(['new', 'due', 'mature']).toContain(wordDeck(w, TODAY))
    }
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

describe('rediscoverPick', () => {
  it('returns null when nothing qualifies (no words, or none mature enough)', () => {
    expect(rediscoverPick([], TODAY)).toBeNull()
    expect(rediscoverPick([word({ id: 'a', stage: 1, dueDate: '2026-08-01' })], TODAY)).toBeNull()
  })

  it('excludes due words even at a qualifying stage', () => {
    const due = word({ id: 'due', stage: REDISCOVER_MIN_STAGE, dueDate: TODAY })
    expect(rediscoverPick([due], TODAY)).toBeNull()
  })

  it('excludes words below REDISCOVER_MIN_STAGE even if not due', () => {
    const tooYoung = word({ id: 'young', stage: REDISCOVER_MIN_STAGE - 1, dueDate: '2026-08-01' })
    expect(rediscoverPick([tooYoung], TODAY)).toBeNull()
  })

  it('picks a single qualifying candidate', () => {
    const w = word({ id: 'solo', stage: REDISCOVER_MIN_STAGE, dueDate: '2026-08-01', lastReviewedAt: '2026-06-01' })
    expect(rediscoverPick([w], TODAY)?.id).toBe('solo')
  })

  it('sorts by staleness — the least-recently-reviewed candidates fill the rotation pool, the freshest is always excluded', () => {
    // With 4 qualifying candidates and a pool of REDISCOVER_POOL (3), the
    // single freshest one should never be picked, on any day — this is
    // robust to exactly which day the internal rotation lands on, unlike
    // asserting a specific winner between just two candidates would be.
    const stale = word({ id: 'stale', stage: 4, dueDate: '2026-08-01', lastReviewedAt: '2026-01-01' })
    const mid1 = word({ id: 'mid1', stage: 4, dueDate: '2026-08-01', lastReviewedAt: '2026-02-01' })
    const mid2 = word({ id: 'mid2', stage: 4, dueDate: '2026-08-01', lastReviewedAt: '2026-03-01' })
    const fresher = word({ id: 'fresher', stage: 4, dueDate: '2026-08-01', lastReviewedAt: '2026-06-15' })
    const candidates = [fresher, mid2, stale, mid1] // shuffled input order — proves sort, not insertion order
    for (let d = 0; d < 14; d++) {
      const today = `2026-07-${String(d + 1).padStart(2, '0')}`
      expect(rediscoverPick(candidates, today)?.id).not.toBe('fresher')
    }
  })

  it('treats equal lastReviewedAt as a tie — both stay eligible across the rotation', () => {
    const high = word({ id: 'high', stage: 6, dueDate: '2026-09-01', lastReviewedAt: '2026-01-01' })
    const low = word({ id: 'low', stage: 4, dueDate: '2026-08-01', lastReviewedAt: '2026-01-01' })
    const picks = new Set()
    for (let d = 0; d < 6; d++) {
      const today = `2026-07-${String(d + 1).padStart(2, '0')}`
      picks.add(rediscoverPick([low, high], today)?.id)
    }
    expect(picks).toEqual(new Set(['low', 'high']))
  })

  it('rotates deterministically across the pool by day, not always the same word', () => {
    const pool = ['a', 'b', 'c'].map((id, i) =>
      word({ id, stage: 4, dueDate: '2026-08-01', lastReviewedAt: `2026-0${i + 1}-01` })
    )
    const day1 = rediscoverPick(pool, '2026-07-07')?.id
    const day2 = rediscoverPick(pool, '2026-07-08')?.id
    // Same inputs, consecutive days — deterministic, and not required to
    // differ every single day, but must always be one of the pool and
    // must be a pure function of `today` (same day → same answer).
    expect(pool.map((w) => w.id)).toContain(day1)
    expect(rediscoverPick(pool, '2026-07-07')?.id).toBe(day1)
    void day2
  })

  it('never picks from beyond the top REDISCOVER_POOL most-neglected candidates', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      word({ id: `w${i}`, stage: 4, dueDate: '2026-08-01', lastReviewedAt: `2026-01-${String(i + 1).padStart(2, '0')}` })
    )
    // The 3 most-neglected are w0, w1, w2 (earliest lastReviewedAt sorts first).
    for (let d = 0; d < 30; d++) {
      const today = `2026-0${1 + Math.floor(d / 28)}-${String((d % 28) + 1).padStart(2, '0')}`
      expect(['w0', 'w1', 'w2']).toContain(rediscoverPick(many, today)?.id)
    }
  })
})
