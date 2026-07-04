import { describe, it, expect } from 'vitest'
import { suggestQuickLogs } from './quickLogs.js'

const TODAY = '2026-07-03'
const daysBefore = (n) => {
  const d = new Date(TODAY + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const entry = (languageId, type, date, hours = 0, minutes = 30, createdAt = date + 'T10:00:00Z') => ({
  id: `${languageId}-${type}-${date}-${createdAt}`,
  languageId, type, date, hours, minutes, createdAt,
})

describe('suggestQuickLogs', () => {
  it('returns an empty array when there are no entries', () => {
    expect(suggestQuickLogs([], { today: TODAY })).toEqual([])
  })

  it('returns a single chip for one entry', () => {
    const e = entry('fr', 'reading', daysBefore(1), 0, 30)
    const out = suggestQuickLogs([e], { today: TODAY })
    expect(out).toEqual([{ languageId: 'fr', type: 'reading', hours: 0, minutes: 30 }])
  })

  it('picks the most recent entry as the first chip', () => {
    const entries = [
      entry('de', 'listening', daysBefore(5), 0, 30),
      entry('fr', 'reading', daysBefore(1), 1, 0),
      entry('fr', 'listening', daysBefore(3), 0, 45),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    expect(out[0]).toEqual({ languageId: 'fr', type: 'reading', hours: 1, minutes: 0 })
  })

  it('picks the most frequent combo in the last 14 days as the second chip', () => {
    // fr/listening happens 3x in the window — that should be the "frequent" pick
    const entries = [
      entry('fr', 'listening', daysBefore(1), 0, 30),
      entry('fr', 'listening', daysBefore(3), 0, 30),
      entry('fr', 'listening', daysBefore(7), 0, 30),
      entry('de', 'reading', daysBefore(2), 1, 0),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    const types = out.map((c) => `${c.languageId}-${c.type}`)
    expect(types).toContain('de-reading')  // most recent
    expect(types).toContain('fr-listening') // most frequent
  })

  it('dedupes when the most recent and most frequent are the same combo', () => {
    const entries = [
      entry('fr', 'listening', daysBefore(1), 0, 30),
      entry('fr', 'listening', daysBefore(3), 0, 30),
      entry('fr', 'listening', daysBefore(7), 0, 30),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ languageId: 'fr', type: 'listening', hours: 0, minutes: 30 })
  })

  it('caps the result at 3 chips', () => {
    const entries = [
      entry('es', 'reading', daysBefore(1)),
      entry('fr', 'listening', daysBefore(2)),
      entry('de', 'grammar', daysBefore(3)),
      entry('it', 'vocabulary', daysBefore(4)),
      entry('pt', 'speaking', daysBefore(5)),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('uses the most recent entry in a combo as the duration anchor, not the sum', () => {
    // fr/reading: one 15m yesterday, one 45m five days ago — chip should be 15m
    const entries = [
      entry('fr', 'reading', daysBefore(1), 0, 15),
      entry('fr', 'reading', daysBefore(5), 0, 45),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    expect(out[0]).toEqual({ languageId: 'fr', type: 'reading', hours: 0, minutes: 15 })
  })

  it('ignores entries older than the 14-day window when ranking frequency', () => {
    // fr/reading happened 5x two months ago (way out of window) and de/listening
    // 2x yesterday. The frequent pick should be de/listening.
    const entries = [
      entry('fr', 'reading', daysBefore(60)),
      entry('fr', 'reading', daysBefore(55)),
      entry('fr', 'reading', daysBefore(50)),
      entry('fr', 'reading', daysBefore(45)),
      entry('fr', 'reading', daysBefore(40)),
      entry('de', 'listening', daysBefore(1)),
      entry('de', 'listening', daysBefore(2)),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    const types = out.map((c) => `${c.languageId}-${c.type}`)
    expect(types).not.toContain('fr-reading') // out of window
    expect(types).toContain('de-listening')   // in-window frequency wins
  })

  it('breaks same-day ties by createdAt (newest first)', () => {
    const entries = [
      entry('fr', 'reading', daysBefore(1), 0, 20, daysBefore(1) + 'T08:00:00Z'),
      entry('fr', 'reading', daysBefore(1), 0, 40, daysBefore(1) + 'T18:00:00Z'),
    ]
    const out = suggestQuickLogs(entries, { today: TODAY })
    expect(out[0].minutes).toBe(40)
  })

  it('handles a non-array entries argument gracefully', () => {
    expect(suggestQuickLogs(null, { today: TODAY })).toEqual([])
    expect(suggestQuickLogs(undefined, { today: TODAY })).toEqual([])
  })

  it('uses today as the default for the window reference', () => {
    // No "today" passed — should still return at least the most recent chip.
    const out = suggestQuickLogs([entry('fr', 'reading', '2026-07-03')])
    expect(out).toHaveLength(1)
    expect(out[0].languageId).toBe('fr')
  })
})
