import { describe, it, expect } from 'vitest'
import { detectMilestone } from './milestones.js'
import { STAGE_RANK } from './avatar.js'

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

describe('detectMilestone — first bloom', () => {
  // Convenience: langs with both the level/hours the older tests care about
  // and the new stageRank / firstBloomAt fields. Keeps each test focused on
  // the bloom logic rather than repeating the level plumbing.
  const fullLang = (over) => ({
    name: 'Spanish', hours: 0, level: 'a1',
    stageRank: STAGE_RANK.seedling, firstBloomAt: null,
    ...over,
  })

  it('fires when a language crosses into bloom for the first time', () => {
    const before = snap({ langs: { es: fullLang({ hours: 48, stageRank: STAGE_RANK.sprout }) } })
    const after = snap({ langs: { es: fullLang({ hours: 52, stageRank: STAGE_RANK.bloom }) } })
    const m = detectMilestone(before, after)
    expect(m.kind).toBe('first_bloom')
    expect(m.langId).toBe('es')
    expect(m.message).toBe('Your Spanish just bloomed.')
  })

  it('does not re-fire once firstBloomAt is set, even if the rank re-enters bloom', () => {
    // Imagine a test that resets the language to 0h and re-climbs: the gate
    // is the persisted timestamp, not the current stage.
    const before = snap({ langs: { es: fullLang({ hours: 0, stageRank: STAGE_RANK.seedling, firstBloomAt: '2026-07-01T00:00:00Z' }) } })
    const after = snap({ langs: { es: fullLang({ hours: 60, stageRank: STAGE_RANK.bloom, firstBloomAt: '2026-07-01T00:00:00Z' }) } })
    expect(detectMilestone(before, after).kind).not.toBe('first_bloom')
  })

  it('does not fire for a language that is already in bloom before the add', () => {
    // A language that's already in bloom (and already marked) stays in bloom.
    // No transition, so the function should report no milestone at all.
    const before = snap({ langs: { es: fullLang({ hours: 60, stageRank: STAGE_RANK.bloom, firstBloomAt: '2026-07-01T00:00:00Z' }) } })
    const after = snap({ langs: { es: fullLang({ hours: 70, stageRank: STAGE_RANK.bloom, firstBloomAt: '2026-07-01T00:00:00Z' }) } })
    expect(detectMilestone(before, after)).toBeNull()
  })

  it('does not fire for a brand-new language (no real "before" to cross from)', () => {
    // First session ever on a new language: stage rank jumps seedling→bloom
    // but there's no before-row, so the diff can't tell us it just crossed.
    // The caller will stamp firstBloomAt on the next crossing detection.
    const after = snap({ langs: { es: fullLang({ hours: 80, stageRank: STAGE_RANK.bloom }) } })
    expect(detectMilestone(snap(), after).kind).not.toBe('first_bloom')
  })

  it('first-bloom wins over a co-occurring level-up', () => {
    // Crossing 50h typically also crosses a CEFR boundary (a2 → b1 for most
    // languages). The visually striking moment — the avatar growing a
    // flower — is the more memorable beat, so it leads.
    const before = snap({ langs: { es: fullLang({ hours: 48, level: 'a2', stageRank: STAGE_RANK.sprout }) } })
    const after = snap({ langs: { es: fullLang({ hours: 60, level: 'b1', stageRank: STAGE_RANK.bloom }) } })
    expect(detectMilestone(before, after).kind).toBe('first_bloom')
  })
})
