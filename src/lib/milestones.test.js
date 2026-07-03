import { describe, it, expect } from 'vitest'
import { detectMilestone } from './milestones.js'

const snap = (over = {}) => ({ streak: 0, weekReached: false, langs: {}, ...over })
const lang = (name, hours, level) => ({ name, hours, level })

describe('detectMilestone', () => {
  it('returns null when nothing changed', () => {
    expect(detectMilestone(snap(), snap())).toBeNull()
  })

  it('celebrates a CEFR level-up', () => {
    const before = snap({ langs: { fr: lang('French', 300, 'a2') } })
    const after = snap({ langs: { fr: lang('French', 320, 'b1') } })
    const m = detectMilestone(before, after)
    expect(m.kind).toBe('level')
    expect(m.message).toContain('French')
    expect(m.message).toContain('B1')
  })

  it('celebrates a streak rung crossing (highest only)', () => {
    const m = detectMilestone(snap({ streak: 6 }), snap({ streak: 7 }))
    expect(m.kind).toBe('streak')
    expect(m.message).toContain('7-day')
  })

  it('does not fire a streak rung that was already cleared', () => {
    expect(detectMilestone(snap({ streak: 8 }), snap({ streak: 9 }))).toBeNull()
  })

  it('celebrates a per-language logged-hours rung', () => {
    const before = snap({ langs: { de: lang('German', 98, 'b1') } })
    const after = snap({ langs: { de: lang('German', 101, 'b1') } })
    const m = detectMilestone(before, after)
    expect(m.kind).toBe('hours')
    expect(m.message).toBe('100 hours in German.')
  })

  it('ranks level-up above an hours rung crossed at the same time', () => {
    const before = snap({ langs: { fr: lang('French', 48, 'a2') } })
    const after = snap({ langs: { fr: lang('French', 52, 'b1') } })
    expect(detectMilestone(before, after).kind).toBe('level')
  })

  it('celebrates completing the weekly goal', () => {
    const m = detectMilestone(snap({ weekReached: false }), snap({ weekReached: true }))
    expect(m.kind).toBe('goal')
  })

  it('does not re-fire the weekly goal once already reached', () => {
    expect(detectMilestone(snap({ weekReached: true }), snap({ weekReached: true }))).toBeNull()
  })

  it('ignores a prior-hours starting credit (no false hours crossing)', () => {
    // A newly-added language whose only change is appearing in the after-snapshot
    // with logged hours below the lowest rung shouldn't fire.
    const after = snap({ langs: { es: lang('Spanish', 5, 'a1') } })
    expect(detectMilestone(snap(), after)).toBeNull()
  })
})
