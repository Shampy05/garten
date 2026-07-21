import { describe, it, expect } from 'vitest'
import { stageDistribution, dueForecast, wateredToday } from './vocabStats.js'

const TODAY = '2026-07-07'

function word(overrides = {}) {
  return { stage: 0, dueDate: TODAY, lapses: 0, reviewCount: 0, ...overrides }
}

describe('stageDistribution', () => {
  it('returns all four stages at zero for an empty garden', () => {
    const dist = stageDistribution([])
    expect(dist.map((s) => s.stage)).toEqual(['seed', 'sprout', 'bloom', 'flourish'])
    expect(dist.every((s) => s.count === 0 && s.percent === 0)).toBe(true)
  })

  it('buckets words by growth stage and computes percent of the whole', () => {
    const words = [
      word({ stage: 0 }), // seed
      word({ stage: 1 }), // seed
      word({ stage: 2 }), // sprout
      word({ stage: 4 }), // bloom
      word({ stage: 6 }), // flourish
    ]
    const dist = stageDistribution(words)
    const byStage = Object.fromEntries(dist.map((s) => [s.stage, s]))
    expect(byStage.seed.count).toBe(2)
    expect(byStage.sprout.count).toBe(1)
    expect(byStage.bloom.count).toBe(1)
    expect(byStage.flourish.count).toBe(1)
    expect(byStage.seed.percent).toBe(40)
    expect(byStage.flourish.percent).toBe(20)
  })

  it('grows more opaque from seed to flourish', () => {
    const dist = stageDistribution([])
    const opacityOf = (c) => Number(c.match(/[\d.]+(?=\)$)/)[0])
    for (let i = 1; i < dist.length; i++) {
      expect(opacityOf(dist[i].color)).toBeGreaterThan(opacityOf(dist[i - 1].color))
    }
  })
})

describe('dueForecast', () => {
  it('buckets overdue and today-due words together as "today"', () => {
    const words = [word({ dueDate: '2026-07-01' }), word({ dueDate: TODAY })]
    expect(dueForecast(words, TODAY)).toEqual({ dueToday: 2, dueTomorrow: 0, dueThisWeek: 0 })
  })

  it('buckets exactly-tomorrow separately from the rest of the week', () => {
    const words = [word({ dueDate: '2026-07-08' }), word({ dueDate: '2026-07-10' }), word({ dueDate: '2026-07-14' })]
    expect(dueForecast(words, TODAY)).toEqual({ dueToday: 0, dueTomorrow: 1, dueThisWeek: 2 })
  })

  it('ignores words due more than 7 days out and words with no dueDate', () => {
    const words = [word({ dueDate: '2026-07-15' }), word({ dueDate: null }), {}]
    expect(dueForecast(words, TODAY)).toEqual({ dueToday: 0, dueTomorrow: 0, dueThisWeek: 0 })
  })
})

describe('wateredToday', () => {
  it('counts only words last reviewed today', () => {
    const words = [
      word({ lastReviewedAt: TODAY }),
      word({ lastReviewedAt: TODAY }),
      word({ lastReviewedAt: '2026-07-06' }),
      word({ lastReviewedAt: null }),
    ]
    expect(wateredToday(words, TODAY)).toBe(2)
  })

  it('returns 0 for an empty garden', () => {
    expect(wateredToday([], TODAY)).toBe(0)
  })
})
