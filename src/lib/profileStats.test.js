import { describe, it, expect } from 'vitest'
import {
  shortLevel,
  languageHorizons,
  longestStreak,
  currentReadingBook,
  selfMilestones,
  plantedOnLabel,
  gardenAnniversary,
  pressedFlowers,
} from './profileStats.js'
import { targetHours } from './proficiency.js'

const entry = (languageId, date, hours = 1, minutes = 0) => ({ languageId, date, hours, minutes })

describe('shortLevel', () => {
  it('returns null for no hours', () => {
    expect(shortLevel('French', 0)).toBeNull()
    expect(shortLevel('French', -5)).toBeNull()
  })

  it('caps at C1+ once the target is reached', () => {
    const t = targetHours('French')
    expect(shortLevel('French', t)).toBe('C1+')
    expect(shortLevel('French', t * 2)).toBe('C1+')
  })

  it('returns an uppercase CEFR key mid-way', () => {
    const t = targetHours('French')
    const lvl = shortLevel('French', t * 0.5) // ~B1 by the level fractions
    expect(['A1', 'A2', 'B1', 'B2']).toContain(lvl)
  })
})

describe('languageHorizons', () => {
  const languages = [
    { id: 'fr', name: 'French', color: '#1', prior_hours: 0 },
    { id: 'de', name: 'German', color: '#2', prior_hours: 10 },
    { id: 'es', name: 'Spanish', color: '#3', prior_hours: 0 },
  ]

  it('drops languages with no accumulated hours', () => {
    const rows = languageHorizons([entry('fr', '2026-01-01', 2)], languages)
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(['fr', 'de']))
    expect(rows.find((r) => r.id === 'es')).toBeUndefined()
  })

  it('adds prior credit to logged hours', () => {
    const rows = languageHorizons([entry('de', '2026-01-01', 5)], languages)
    const de = rows.find((r) => r.id === 'de')
    expect(de.hours).toBe(15) // 10 prior + 5 logged
  })

  it('sorts by most tended first and clamps pct to 100', () => {
    const rows = languageHorizons(
      [entry('fr', '2026-01-01', 3), entry('de', '2026-01-01', 1)],
      languages
    )
    expect(rows[0].id).toBe('de') // 11h vs 3h
    for (const r of rows) expect(r.pct).toBeLessThanOrEqual(100)
  })
})

describe('longestStreak', () => {
  it('is 0 for no dates', () => {
    expect(longestStreak([])).toBe(0)
  })

  it('finds the longest consecutive run, ignoring gaps and dupes', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-02', '2026-01-03', '2026-01-06', '2026-01-07']
    expect(longestStreak(dates)).toBe(3)
  })

  it('handles a single day', () => {
    expect(longestStreak(['2026-01-01'])).toBe(1)
  })
})

describe('currentReadingBook', () => {
  const mk = (id, status, startedAt, cur, tot) => ({
    id,
    title: `Book ${id}`,
    author: 'A',
    coverUrl: null,
    languageCode: 'fr',
    record: { status, startedAt, currentPage: cur, totalPages: tot },
  })

  it('returns null when nothing is being read', () => {
    expect(currentReadingBook([])).toBeNull()
    expect(currentReadingBook([mk('1', 'want_to_read', null, 0, 100)])).toBeNull()
    expect(currentReadingBook([mk('1', 'read', '2026-01-01', 100, 100)])).toBeNull()
  })

  it('prefers the most recently started in-progress book', () => {
    const book = currentReadingBook([
      mk('old', 'reading', '2026-01-01', 10, 100),
      mk('new', 'reading', '2026-02-01', 5, 100),
    ])
    expect(book.id).toBe('new')
  })

  it('computes a clamped percentage', () => {
    const book = currentReadingBook([mk('1', 'reading', '2026-01-01', 50, 200)])
    expect(book.pct).toBe(25)
  })
})

describe('selfMilestones', () => {
  it('returns nothing for an empty garden', () => {
    expect(selfMilestones({})).toEqual([])
  })

  it('shows only the highest cleared hour rung', () => {
    // 60 one-hour sessions on distinct days → 60 total hours → 50 rung, not 25.
    const entries = Array.from({ length: 60 }, (_, i) =>
      entry('fr', `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, 1)
    )
    const ms = selfMilestones({ entries })
    const hourMs = ms.filter((m) => m.key === 'hours')
    expect(hourMs).toHaveLength(1)
    expect(hourMs[0].label).toBe('50+ hours tended')
  })

  it('counts finished books', () => {
    const savedBooks = [
      { record: { status: 'read' } },
      { record: { status: 'read' } },
      { record: { status: 'reading' } },
    ]
    const ms = selfMilestones({ savedBooks })
    expect(ms.find((m) => m.key === 'books').label).toBe('2 books finished')
  })

  it('respects the limit', () => {
    const entries = Array.from({ length: 400 }, (_, i) => {
      const d = new Date('2025-01-01T12:00:00')
      d.setDate(d.getDate() + i)
      return entry('fr', d.toISOString().slice(0, 10), 3)
    })
    const savedBooks = [{ record: { status: 'read' } }]
    const ms = selfMilestones({ entries, savedBooks }, 2)
    expect(ms.length).toBeLessThanOrEqual(2)
  })
})

describe('plantedOnLabel', () => {
  it('returns null for no date', () => {
    expect(plantedOnLabel(null)).toBeNull()
    expect(plantedOnLabel('not-a-date')).toBeNull()
  })

  it('formats a full date', () => {
    const label = plantedOnLabel('2026-03-14T10:00:00.000Z')
    expect(label).toMatch(/^Planted /)
    expect(label).toContain('2026')
  })
})

describe('gardenAnniversary', () => {
  it('returns null for no date or less than a year', () => {
    expect(gardenAnniversary(null, '2026-07-04')).toBeNull()
    expect(gardenAnniversary('2026-01-01T10:00:00.000Z', '2026-07-04')).toBeNull()
  })

  it('fires on the anniversary date', () => {
    const ann = gardenAnniversary('2025-07-04T10:00:00.000Z', '2026-07-04')
    expect(ann).toEqual({ years: 1 })
  })

  it('is null on a non-anniversary day', () => {
    expect(gardenAnniversary('2025-07-04T10:00:00.000Z', '2026-07-05')).toBeNull()
  })

  it('celebrates a Feb 29 planting on Mar 1 in a non-leap year', () => {
    expect(gardenAnniversary('2024-02-29T10:00:00.000Z', '2025-03-01')).toEqual({ years: 1 })
    expect(gardenAnniversary('2024-02-29T10:00:00.000Z', '2025-02-28')).toBeNull()
  })
})

describe('pressedFlowers', () => {
  const languages = [
    { id: 'fr', name: 'French', color: '#1', first_bloom_at: '2026-02-01T00:00:00.000Z' },
    { id: 'de', name: 'German', color: '#2', first_bloom_at: null },
    { id: 'es', name: 'Spanish', color: '#3', first_bloom_at: null },
  ]

  it('includes languages past the bloom threshold even without a stamp', () => {
    // 55 one-hour sessions → 55 logged hours, past STAGE_HOURS.bloom (50).
    const entries = Array.from({ length: 55 }, (_, i) =>
      entry('de', `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, 1)
    )
    const flowers = pressedFlowers(entries, languages)
    expect(flowers.map((f) => f.id)).toContain('de')
  })

  it('drops languages below the threshold with no stamp', () => {
    const entries = [entry('es', '2026-01-01', 2)]
    const flowers = pressedFlowers(entries, languages)
    expect(flowers.find((f) => f.id === 'es')).toBeUndefined()
  })

  it('includes a stamped language regardless of hours', () => {
    const flowers = pressedFlowers([], languages)
    expect(flowers.map((f) => f.id)).toEqual(['fr'])
  })

  it('sorts dated flowers oldest-first, undated last', () => {
    const langs = [
      { id: 'a', name: 'A', color: '#1', first_bloom_at: '2026-03-01T00:00:00.000Z' },
      { id: 'b', name: 'B', color: '#2', first_bloom_at: '2026-01-01T00:00:00.000Z' },
      { id: 'c', name: 'C', color: '#3', first_bloom_at: null },
    ]
    const entries = Array.from({ length: 55 }, (_, i) =>
      entry('c', `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, 1)
    )
    const flowers = pressedFlowers(entries, langs)
    expect(flowers.map((f) => f.id)).toEqual(['b', 'a', 'c'])
  })

  it('uses the nickname when set', () => {
    const langs = [{ id: 'fr', name: 'French', nickname: 'Français', color: '#1', first_bloom_at: '2026-01-01T00:00:00.000Z' }]
    const flowers = pressedFlowers([], langs)
    expect(flowers[0].name).toBe('Français')
  })
})
