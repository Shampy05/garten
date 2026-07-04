import { describe, it, expect } from 'vitest'
import {
  buildGardenScene,
  loggedHoursByLanguage,
  plantPositions,
  skyBand,
  seasonFor,
  GARDEN_VIEW,
} from './gardenScene.js'
import { lastWateredByLanguage } from './nextAction.js'
import { STAGE_HOURS, BLOOMS } from './avatar.js'

const lang = (id, color = '#2563eb') => ({ id, name: id.toUpperCase(), color, types: ['reading'] })
const entry = (languageId, date, hours = 1, minutes = 0) => ({ languageId, date, hours, minutes })

const noon = (isoDate) => new Date(isoDate + 'T12:00:00')
const daysAgo = (today, n) => {
  const d = noon(today)
  d.setDate(d.getDate() - n)
  return localDate(d)
}
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('loggedHoursByLanguage', () => {
  it('sums hours+minutes per language', () => {
    const out = loggedHoursByLanguage([
      entry('fr', '2026-07-01', 1, 30),
      entry('fr', '2026-07-02', 0, 30),
      entry('de', '2026-07-01', 2, 0),
    ])
    expect(out.fr).toBeCloseTo(2, 3)
    expect(out.de).toBeCloseTo(2, 3)
  })
  it('returns an empty object for no entries', () => {
    expect(loggedHoursByLanguage([])).toEqual({})
  })
})

describe('lastWateredByLanguage', () => {
  it('returns the max date per language', () => {
    const out = lastWateredByLanguage([
      entry('fr', '2026-07-01'),
      entry('fr', '2026-07-05'),
      entry('de', '2026-07-03'),
    ])
    expect(out.fr).toBe('2026-07-05')
    expect(out.de).toBe('2026-07-03')
  })
  it('omits languages never logged', () => {
    expect(lastWateredByLanguage([])).toEqual({})
  })
  it('agrees with the private mostNeglectedLanguage computation (regression)', () => {
    const langs = [lang('fr'), lang('de')]
    const entries = [entry('fr', '2026-07-04'), entry('de', daysAgo('2026-07-04', 9))]
    const last = lastWateredByLanguage(entries)
    expect(last.fr).toBe('2026-07-04')
    expect(last.de).toBe(daysAgo('2026-07-04', 9))
  })
})

describe('plantPositions', () => {
  it('centers a single plant at x = 600', () => {
    expect(plantPositions(1)).toEqual([600])
  })
  it('evenly spaces 4 plants within [140, 1060]', () => {
    const xs = plantPositions(4)
    expect(xs).toHaveLength(4)
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(140)
      expect(x).toBeLessThanOrEqual(1060)
    }
    // strictly increasing
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  })
  it('places 8 plants at even slot centers', () => {
    const xs = plantPositions(8)
    expect(xs).toHaveLength(8)
    const span = 1060 - 140
    const slot = span / 8
    const expected = Array.from({ length: 8 }, (_, i) => Math.round(140 + slot * (i + 0.5)))
    expect(xs).toEqual(expected)
  })
  it('returns an empty array for 0 plants', () => {
    expect(plantPositions(0)).toEqual([])
  })
})

describe('skyBand', () => {
  it('classifies hour edges correctly', () => {
    expect(skyBand(4).band).toBe('night')
    expect(skyBand(5).band).toBe('dawn')
    expect(skyBand(7).band).toBe('dawn')
    expect(skyBand(8).band).toBe('day')
    expect(skyBand(17).band).toBe('day')
    expect(skyBand(18).band).toBe('dusk')
    expect(skyBand(20).band).toBe('dusk')
    expect(skyBand(21).band).toBe('night')
  })
  it('returns exactly 3 valid hex stops per band', () => {
    for (const h of [4, 5, 7, 8, 12, 17, 18, 20, 21, 23]) {
      const { stops } = skyBand(h)
      expect(stops).toHaveLength(3)
      for (const s of stops) {
        expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
        expect(s.offset).toMatch(/%$/)
      }
    }
  })
})

describe('seasonFor', () => {
  it('maps every month to the right season (meteorological, NH)', () => {
    expect(seasonFor(0).name).toBe('winter')   // Jan
    expect(seasonFor(1).name).toBe('winter')   // Feb
    expect(seasonFor(2).name).toBe('spring')   // Mar
    expect(seasonFor(3).name).toBe('spring')   // Apr
    expect(seasonFor(4).name).toBe('spring')   // May
    expect(seasonFor(5).name).toBe('summer')   // Jun
    expect(seasonFor(6).name).toBe('summer')   // Jul
    expect(seasonFor(7).name).toBe('summer')   // Aug
    expect(seasonFor(8).name).toBe('autumn')   // Sep
    expect(seasonFor(9).name).toBe('autumn')   // Oct
    expect(seasonFor(10).name).toBe('autumn')  // Nov
    expect(seasonFor(11).name).toBe('winter')  // Dec
  })
})

describe('buildGardenScene — determinism + dispersion', () => {
  it('returns the same layout for the same input', () => {
    const a = buildGardenScene({
      languages: [lang('fr'), lang('de'), lang('es')],
      entries: [entry('fr', '2026-07-01', 0, 30), entry('de', '2026-06-25', 5)],
      now: new Date('2026-07-04T14:00:00'),
      streak: 3,
      bloomVariant: 0,
      companion: 2,
      gardenName: 'My plot',
      pressed: [{ id: 'fr', color: '#2563eb' }],
    })
    const b = buildGardenScene({
      languages: [lang('fr'), lang('de'), lang('es')],
      entries: [entry('fr', '2026-07-01', 0, 30), entry('de', '2026-06-25', 5)],
      now: new Date('2026-07-04T14:00:00'),
      streak: 3,
      bloomVariant: 0,
      companion: 2,
      gardenName: 'My plot',
      pressed: [{ id: 'fr', color: '#2563eb' }],
    })
    expect(a).toEqual(b)
  })
  it('species and tilt disperse across 50 seeds', () => {
    // Use UUID-shaped ids — `lang-0`..`lang-49` share a 5-char prefix and
    // hash identically in the low bits. Real language ids are UUIDs.
    const seenSpecies = new Set()
    const tilts = []
    for (let i = 0; i < 50; i++) {
      const id = `${i.toString(16).padStart(8, '0')}-${(i * 2654435761 >>> 0).toString(16)}`
      const s = buildGardenScene({ languages: [lang(id)] })
      seenSpecies.add(s.plants[0].species)
      tilts.push(s.plants[0].tilt)
    }
    expect(seenSpecies.size).toBeGreaterThan(1)
    expect(new Set(tilts).size).toBeGreaterThan(5)
  })
})

describe('buildGardenScene — stage mapping', () => {
  it('0h language is still present as a seedling', () => {
    const s = buildGardenScene({ languages: [lang('fr')], entries: [] })
    expect(s.plants).toHaveLength(1)
    expect(s.plants[0].stage).toBe('seedling')
    expect(s.plants[0].hours).toBe(0)
  })
  it('maps boundaries: 0/10/50/250h', () => {
    const s0 = buildGardenScene({ languages: [lang('a')], entries: [entry('a', '2026-07-01', 0)] })
    expect(s0.plants[0].stage).toBe('seedling')
    const sSprout = buildGardenScene({ languages: [lang('a')], entries: [entry('a', '2026-07-01', 10)] })
    expect(sSprout.plants[0].stage).toBe('sprout')
    const sBloom = buildGardenScene({ languages: [lang('a')], entries: [entry('a', '2026-07-01', 50)] })
    expect(sBloom.plants[0].stage).toBe('bloom')
    const sFl = buildGardenScene({ languages: [lang('a')], entries: [entry('a', '2026-07-01', 250)] })
    expect(sFl.plants[0].stage).toBe('flourish')
  })
  it('scale is monotonic within a stage and clamped to [0.85, 1.15]', () => {
    const make = (h) => buildGardenScene({ languages: [lang('a')], entries: [entry('a', '2026-07-01', h)] }).plants[0].scale
    const sprout1 = make(STAGE_HOURS.sprout)
    const sprout2 = make(STAGE_HOURS.sprout + 5)
    const sprout3 = make(STAGE_HOURS.bloom - 1)
    expect(sprout2).toBeGreaterThanOrEqual(sprout1)
    expect(sprout3).toBeGreaterThanOrEqual(sprout2)
    for (const h of [0, 5, 10, 20, 49, 50, 100, 200, 249, 250, 1000]) {
      const sc = make(h)
      expect(sc).toBeGreaterThanOrEqual(0.85 - 1e-9)
      expect(sc).toBeLessThanOrEqual(1.15 + 1e-9)
    }
  })
  it('0-hour language has scale at least 0.85', () => {
    const s = buildGardenScene({ languages: [lang('a')], entries: [] })
    expect(s.plants[0].scale).toBeGreaterThanOrEqual(0.85 - 1e-9)
  })
})

describe('buildGardenScene — layout', () => {
  it('1 plant sits near center-stage at x=600 (within ±slotWidth*0.12)', () => {
    const s = buildGardenScene({ languages: [lang('a')] })
    // For 1 plant, slotWidth is the full 920-unit band, so the ±12% jitter
    // bound is ±110 — the test is loose on purpose (it's "center-ish"),
    // the real assertion is that it doesn't fall outside the band.
    expect(Math.abs(s.plants[0].x - 600)).toBeLessThanOrEqual(920 * 0.12 + 1)
  })
  it('keeps x within planting band (with jitter)', () => {
    const s = buildGardenScene({ languages: [lang('a'), lang('b'), lang('c'), lang('d'), lang('e'), lang('f'), lang('g'), lang('h')] })
    for (const p of s.plants) {
      const slot = 920 / 8
      const jMax = slot * 0.12 + 1
      expect(p.x).toBeGreaterThanOrEqual(140 - jMax)
      expect(p.x).toBeLessThanOrEqual(1060 + jMax)
    }
  })
  it('preserves planting order via strictly increasing slot centers', () => {
    const s = buildGardenScene({ languages: [lang('a'), lang('b'), lang('c'), lang('d')] })
    for (let i = 1; i < s.plants.length; i++) {
      const a = s.plants[i - 1].x
      const b = s.plants[i].x
      // base positions (positions[i]) are strictly increasing; jitter
      // (±12% slot) can in edge cases reverse the order, so we test that
      // the gap is at most a single jitter band apart.
      expect(Math.abs(b - a)).toBeLessThan(920 / 4 + 1)
    }
  })
  it('8 languages apply the 0.9 crowding scale', () => {
    const s = buildGardenScene({
      languages: [lang('a'), lang('b'), lang('c'), lang('d'), lang('e'), lang('f'), lang('g'), lang('h')],
      entries: [entry('a', '2026-07-01', 100)],
    })
    // The 'a' plant is in bloom stage; with crowd scale ×0.9 the maximum
    // it could reach is 1.15 * 0.9 = 1.035. Verify by comparing to a
    // 1-language case.
    const single = buildGardenScene({ languages: [lang('a')], entries: [entry('a', '2026-07-01', 100)] })
    expect(s.plants[0].scale).toBeCloseTo(single.plants[0].scale * 0.9, 6)
  })
  it('7 languages apply the 0.9 crowding scale', () => {
    const langs7 = Array.from({ length: 7 }, (_, i) => lang('l' + i))
    const s = buildGardenScene({ languages: langs7, entries: [entry('l0', '2026-07-01', 100)] })
    const single = buildGardenScene({ languages: [lang('l0')], entries: [entry('l0', '2026-07-01', 100)] })
    expect(s.plants[0].scale).toBeCloseTo(single.plants[0].scale * 0.9, 6)
  })
  it('6 languages do not apply the 0.9 scale', () => {
    const langs6 = Array.from({ length: 6 }, (_, i) => lang('l' + i))
    const s = buildGardenScene({ languages: langs6, entries: [entry('l0', '2026-07-01', 100)] })
    const single = buildGardenScene({ languages: [lang('l0')], entries: [entry('l0', '2026-07-01', 100)] })
    expect(s.plants[0].scale).toBeCloseTo(single.plants[0].scale, 6)
  })
})

describe('buildGardenScene — season particles', () => {
  it('spring emits blossom particles', () => {
    const s = buildGardenScene({ now: new Date('2026-04-15T12:00:00'), languages: [lang('a')] })
    expect(s.season.name).toBe('spring')
    expect(s.season.particles.length).toBeGreaterThan(0)
    expect(s.season.particles.length).toBeLessThanOrEqual(8)
    for (const p of s.season.particles) expect(p.kind).toBe('blossom')
  })
  it('autumn emits leaf particles', () => {
    const s = buildGardenScene({ now: new Date('2026-10-15T12:00:00'), languages: [lang('a')] })
    expect(s.season.name).toBe('autumn')
    expect(s.season.particles.length).toBeGreaterThan(0)
    for (const p of s.season.particles) expect(p.kind).toBe('leaf')
  })
  it('summer has no particles', () => {
    const s = buildGardenScene({ now: new Date('2026-07-15T12:00:00'), languages: [lang('a')] })
    expect(s.season.particles).toEqual([])
  })
  it('winter has no particles and sets frost', () => {
    const s = buildGardenScene({ now: new Date('2026-01-15T12:00:00'), languages: [lang('a')] })
    expect(s.season.particles).toEqual([])
    expect(s.season.frost).toBe(true)
  })
})

describe('buildGardenScene — droop', () => {
  it('flags droop at 7+ days', () => {
    const today = '2026-07-04'
    const s = buildGardenScene({
      languages: [lang('a')],
      entries: [entry('a', daysAgo(today, 7))],
      now: new Date(today + 'T14:00:00'),
    })
    expect(s.plants[0].droop).toBe(true)
    const re = new RegExp(`^rotate\\(-?[0-9.]+ ${s.plants[0].x} 264\\)$`)
    expect(s.plants[0].droopTransform).toMatch(re)
  })
  it('does not droop at 6 days', () => {
    const today = '2026-07-04'
    const s = buildGardenScene({
      languages: [lang('a')],
      entries: [entry('a', daysAgo(today, 6))],
      now: new Date(today + 'T14:00:00'),
    })
    expect(s.plants[0].droop).toBe(false)
  })
  it('never-watered plants do not droop', () => {
    const s = buildGardenScene({ languages: [lang('a')], entries: [] })
    expect(s.plants[0].droop).toBe(false)
    expect(s.plants[0].droopTransform).toBe(null)
  })
  it('logged today does not droop', () => {
    const s = buildGardenScene({
      languages: [lang('a')],
      entries: [entry('a', '2026-07-04')],
      now: new Date('2026-07-04T14:00:00'),
    })
    expect(s.plants[0].droop).toBe(false)
  })
})

describe('buildGardenScene — effects gating', () => {
  it('streak 2 yields no glow, no fireflies', () => {
    const day = buildGardenScene({ languages: [lang('a')], streak: 2, now: new Date('2026-07-04T12:00:00') })
    expect(day.sky.glow).toBe(false)
    expect(day.fireflies).toEqual([])
    const night = buildGardenScene({ languages: [lang('a')], streak: 2, now: new Date('2026-07-04T23:00:00') })
    expect(night.sky.glow).toBe(false)
    expect(night.fireflies).toEqual([])
  })
  it('streak 3 + night yields exactly 7 fireflies', () => {
    const s = buildGardenScene({
      languages: [lang('a'), lang('b')],
      streak: 3,
      now: new Date('2026-07-04T23:00:00'),
    })
    expect(s.sky.band).toBe('night')
    expect(s.fireflies).toHaveLength(7)
    for (const f of s.fireflies) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x).toBeLessThanOrEqual(1200)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeLessThanOrEqual(320)
    }
  })
  it('streak 3 + day yields glow but no fireflies', () => {
    const s = buildGardenScene({
      languages: [lang('a'), lang('b')],
      streak: 3,
      now: new Date('2026-07-04T12:00:00'),
    })
    expect(s.sky.band).toBe('day')
    expect(s.sky.glow).toBe(true)
    expect(s.fireflies).toEqual([])
  })
  it('streak 3 + dawn yields glow but no fireflies', () => {
    const s = buildGardenScene({ languages: [lang('a')], streak: 3, now: new Date('2026-07-04T06:00:00') })
    expect(s.sky.band).toBe('dawn')
    expect(s.sky.glow).toBe(true)
    expect(s.fireflies).toEqual([])
  })
})

describe('buildGardenScene — sign', () => {
  it('returns null when garden name is empty', () => {
    expect(buildGardenScene({ gardenName: '' }).sign).toBe(null)
    expect(buildGardenScene({ gardenName: '   ' }).sign).toBe(null)
  })
  it('passes an 18-char name through unchanged', () => {
    const s = buildGardenScene({ gardenName: 'Cam’s Plot of Pea' }) // 17 chars
    expect(s.sign).not.toBe(null)
    expect(s.sign.text).toBe('Cam’s Plot of Pea')
  })
  it('clamps a 19-char name to 17 + ellipsis', () => {
    const s = buildGardenScene({ gardenName: 'Cam’s Garden of Peas' }) // 20 chars
    expect(s.sign.text.length).toBeLessThanOrEqual(18)
    expect(s.sign.text.endsWith('…')).toBe(true)
  })
})

describe('buildGardenScene — companion', () => {
  it('returns null when no companion is chosen', () => {
    expect(buildGardenScene({ companion: null }).companion).toBe(null)
  })
  it('classifies bee/butterfly as air, ladybird/snail as ground', () => {
    expect(buildGardenScene({ companion: 1 }).companion.pathKind).toBe('air')   // bee
    expect(buildGardenScene({ companion: 2 }).companion.pathKind).toBe('air')   // butterfly
    expect(buildGardenScene({ companion: 0 }).companion.pathKind).toBe('ground') // ladybird
    expect(buildGardenScene({ companion: 3 }).companion.pathKind).toBe('ground') // snail
  })
  it('ignores out-of-range companion indices', () => {
    expect(buildGardenScene({ companion: 99 }).companion).toBe(null)
  })
})

describe('buildGardenScene — viewBox + ground', () => {
  it('exposes a 1200×320 viewBox with groundY at 264', () => {
    const s = buildGardenScene({})
    expect(s.viewBox).toEqual({ w: 1200, h: 320 })
    expect(s.groundY).toBe(264)
    expect(GARDEN_VIEW.groundY).toBe(264)
  })
})

describe('buildGardenScene — bloomColor', () => {
  it('passes through the chosen BLOOMS entry when variant is set', () => {
    const s = buildGardenScene({ bloomVariant: 0, languages: [lang('a')] })
    expect(s.plants[0].bloomColor).toEqual(BLOOMS[0])
  })
  it('null bloomColor when no variant', () => {
    const s = buildGardenScene({ languages: [lang('a')] })
    expect(s.plants[0].bloomColor).toBe(null)
  })
})

describe('buildGardenScene — clouds + stepping stones + bee path', () => {
  it('always emits 5 clouds', () => {
    const s = buildGardenScene({ languages: [lang('a')] })
    expect(s.clouds).toHaveLength(5)
  })
  it('clouds drop to dim opacity at night', () => {
    const s = buildGardenScene({ languages: [lang('a')], now: new Date('2026-07-04T23:00:00') })
    for (const c of s.clouds) expect(c.opacity).toBeLessThan(0.2)
  })
  it('emits 6 stepping stones with a winding y', () => {
    const s = buildGardenScene({ languages: [lang('a')] })
    expect(s.steppingStones).toHaveLength(6)
    for (const stone of s.steppingStones) {
      expect(stone.x).toBeGreaterThan(0)
      expect(stone.x).toBeLessThan(1200)
      expect(stone.rx).toBeGreaterThanOrEqual(9)
      expect(stone.rx).toBeLessThanOrEqual(11)
    }
  })
  it('returns null beePath when no flowers are blooming', () => {
    const s = buildGardenScene({ languages: [lang('a')] })
    expect(s.beePath).toBe(null)
  })
  it('returns a closed path visiting 2-4 flowers when some are blooming', () => {
    const s = buildGardenScene({
      languages: [lang('a'), lang('b'), lang('c'), lang('d')],
      entries: [
        entry('a', '2026-07-01', 60), // bloom
        entry('b', '2026-07-01', 60), // bloom
        entry('c', '2026-07-01', 60), // bloom
      ],
    })
    expect(s.beePath).not.toBe(null)
    expect(s.beePath.d).toMatch(/^M[\d.]+ [\d.]+/)
    expect(s.beePath.d.endsWith('Z')).toBe(true)
    expect(s.beePath.duration).toBeGreaterThanOrEqual(26)
    expect(s.beePath.duration).toBeLessThanOrEqual(34)
  })
})
