// Generative "Your Garden" hero scene — pure view-model.
//
// Every input is data the app already holds: languages, entries, streak, the
// chosen bloom variant + companion, the garden name, and pressed blooms. The
// builder returns a fully declarative layout (numbers in viewBox units) that
// GardenScene.vue renders with no further computation. Determinism is the
// point: hashed per-language cosmetics from hashSeed(languageId) so the same
// garden looks the same on reload, the same in the PNG portrait, and the
// same in tests. `now` is injected so the test suite can pin any time/season
// without mocking the clock.

import { hashSeed, growthStage, STAGE_HOURS, BLOOMS, COMPANIONS } from './avatar.js'
import { lastWateredByLanguage } from './nextAction.js'
import { localDateStr } from './date.js'

const VIEW_W = 1200
const VIEW_H = 320
const GROUND_Y = 264

// Renderer-side magnification applied to every plant, anchored at the stem
// base. The silhouette geometry below is authored at avatar-ish proportions;
// without this the plants read as specks against a 320-unit-tall sky.
export const PRESENCE = 1.5

// Stage size per species — heights in viewBox units. The renderer scales each
// plant by `plant.scale` *within* its stage (interpolated from logged hours
// within the stage band), so 40h sprouts and 49h sprouts visibly differ.
const SPECIES = {
  0: { name: 'flower' },
  1: { name: 'bush' },
  2: { name: 'bell' },
  3: { name: 'spike' },
}

// Per-stage geometry — silhouette height in viewBox units before scale.
// Order matters: stemToY = groundY - height, then leaves/petals are
// computed relative to stemToY by the renderer.
const STAGE_GEOM = {
  seedling: { height: 6 },
  sprout: { height: 40 },
  bloom: { height: 78 },
  flourish: { height: 110 },
}

// Stage floor/ceiling in hours (mirrors STAGE_HOURS) — used for the within-
// stage size lerp. The order matches `STAGES`.
const STAGE_BANDS = [
  { name: 'seedling', floor: 0, ceil: STAGE_HOURS.sprout },
  { name: 'sprout', floor: STAGE_HOURS.sprout, ceil: STAGE_HOURS.bloom },
  { name: 'bloom', floor: STAGE_HOURS.bloom, ceil: STAGE_HOURS.flourish },
  { name: 'flourish', floor: STAGE_HOURS.flourish, ceil: STAGE_HOURS.flourish * 2 },
]

// -- public helpers -----------------------------------------------------------

// Total logged hours per language, keyed by id. Matches avatar/pressed-flower
// semantics: logged only (no prior-hours credit), 0-hour languages present so
// the scene can plant a seed mound for them.
export function loggedHoursByLanguage(entries = []) {
  const out = {}
  for (const e of entries) {
    out[e.languageId] = (out[e.languageId] || 0) + e.hours * 60 + e.minutes
  }
  for (const k of Object.keys(out)) out[k] = out[k] / 60
  return out
}

// Hours logged per language in the last `days` days. The "momentum" signal
// the scene uses to scale a plant — a friend who did 50h of Urdu this week
// but only 2h total should still feel alive in the garden, not a tiny
// seedling. Window defaults to 7 days. 0-hour languages are absent.
export function recentHoursByLanguage(entries = [], days = 7, now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = localDateStr(cutout(cutoff))
  const out = {}
  for (const e of entries) {
    if (e.date >= cutoffStr) {
      out[e.languageId] = (out[e.languageId] || 0) + e.hours * 60 + e.minutes
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k] / 60
  return out
}

// Pure helper: returns a fresh Date from a Date (avoids a stray `cutout` typo
// polluting the exports above).
function cutout(d) { return d }

// Map recent hours (last 7 days) to a scale multiplier. Neglected plants
// shrink to 0.75×, thriving plants grow to 1.3×. The midpoint is 2–4h/week
// (a calm steady cadence). The 1.0× floor sits at the bottom of the "normal"
// range so a brand-new plant (0 momentum) is visibly smaller than an
// established one, not the same.
function momentumScale(recentHours) {
  if (recentHours <= 0) return 0.75
  if (recentHours < 1) return 0.85
  if (recentHours < 2) return 0.95
  if (recentHours < 4) return 1.0
  if (recentHours < 7) return 1.1
  if (recentHours < 10) return 1.2
  return 1.3
}

// "Even slots" across the planting band [140, 1060], one language per slot.
// A lone language gets center-stage at x=600 (intentional, not a bug). The
// caller adds hashed jitter in buildGardenScene.
export function plantPositions(count, width = VIEW_W) {
  if (count === 0) return []
  if (count === 1) return [Math.round(width / 2)]
  const startX = 140
  const endX = width - 140
  const span = endX - startX
  const slot = span / count
  return Array.from({ length: count }, (_, i) => Math.round(startX + slot * (i + 0.5)))
}

// Time-of-day sky band. Hour-granularity — the scene's coarsest time gate is
// an hour wide so a 10-min tick is more than enough. Returns the band name +
// three gradient stops (top → mid → horizon) so the renderer paints a single
// <linearGradient> <rect>.
export function skyBand(hour) {
  if (hour >= 5 && hour <= 7) {
    return {
      band: 'dawn',
      stops: [
        { offset: '0%', color: '#dfe9f3' },
        { offset: '55%', color: '#f6e3d3' },
        { offset: '100%', color: '#f9ead8' },
      ],
    }
  }
  if (hour >= 8 && hour <= 17) {
    return {
      band: 'day',
      stops: [
        { offset: '0%', color: '#dceef7' },
        { offset: '55%', color: '#eaf4ef' },
        { offset: '100%', color: '#f6f7f0' },
      ],
    }
  }
  if (hour >= 18 && hour <= 20) {
    return {
      band: 'dusk',
      stops: [
        { offset: '0%', color: '#d8dcee' },
        { offset: '55%', color: '#ecd9d4' },
        { offset: '100%', color: '#f3e2cf' },
      ],
    }
  }
  return {
    band: 'night',
    stops: [
      { offset: '0%', color: '#2e3a4e' },
      { offset: '55%', color: '#3d4a5c' },
      { offset: '100%', color: '#55606b' },
    ],
  }
}

// Where the sun (or moon) sits, from the real hour. The sun rides a low arc
// across the planting band between 05:00 and 20:00 — leftmost at dawn,
// highest around midday, rightmost at dusk — so "the sky follows real time"
// is legible at a glance rather than just a gradient shift. At night a
// crescent moon hangs in the upper right.
export function celestialFor(hour) {
  if (hour >= 5 && hour <= 20) {
    const t = (hour - 5) / 15
    return {
      kind: 'sun',
      x: Math.round(140 + t * 920),
      y: Math.round(170 - 110 * Math.sin(t * Math.PI)),
      r: 24,
    }
  }
  return { kind: 'moon', x: 950, y: 66, r: 20 }
}

// Northern-hemisphere meteorological seasons (Mar–May spring, etc.). The
// scene tints leaves and grass by season; winter gets a frost line and
// spring/autumn emit ≤8 drift particles. Hemisphere setting is out of scope
// for v1.
export function seasonFor(month) {
  if (month >= 2 && month <= 4) return { name: 'spring' }
  if (month >= 5 && month <= 7) return { name: 'summer' }
  if (month >= 8 && month <= 10) return { name: 'autumn' }
  return { name: 'winter' }
}

// Noon-anchored day math, matching nextAction.js / cache.js: differences
// measured at 12:00 local so a same-day comparison isn't floored by timezone.
function daysSinceNoon(dateStr, todayStr) {
  if (!dateStr) return Infinity
  const a = new Date(todayStr + 'T12:00:00')
  const b = new Date(dateStr + 'T12:00:00')
  return Math.round((a - b) / 86400000)
}

// -- the main builder ---------------------------------------------------------

export function buildGardenScene({
  languages = [],
  entries = [],
  now = new Date(),
  streak = 0,
  bloomVariant = null,
  companion = null,
  gardenName = '',
  pressed = [],
} = {}) {
  const hoursByLang = loggedHoursByLanguage(entries)
  const lastByLang = lastWateredByLanguage(entries)
  const todayStr = localDateStr(now)
  const hour = now.getHours()
  const month = now.getMonth()

  // ---- sky ----
  const skyRaw = skyBand(hour)
  const seasonName = seasonFor(month).name
  let skyStops = skyRaw.stops
  if (seasonName === 'winter') {
    // Cool-shift every stop 15% toward #dfe6ec — a faint wintry wash.
    skyStops = skyRaw.stops.map((s) => ({ offset: s.offset, color: mixHex(s.color, '#dfe6ec', 0.15) }))
  }
  const sky = { band: skyRaw.band, stops: skyStops, glow: streak >= 3 && skyRaw.band !== 'night' }

  // ---- season tints + particles ----
  const SEASON_TINTS = {
    spring: { leafTint: '#5cae6b', grassTint: '#9ed4a4' },
    summer: { leafTint: '#389150', grassTint: '#8fca98' },
    autumn: { leafTint: '#7a8a4a', grassTint: '#a8b27a' },
    winter: { leafTint: '#6a7a6a', grassTint: '#b8c4b0' },
  }
  const tint = SEASON_TINTS[seasonName]
  const season = {
    name: seasonName,
    leafTint: tint.leafTint,
    grassTint: tint.grassTint,
    frost: seasonName === 'winter',
    particles: buildParticles(seasonName),
  }

  // ---- layout ----
  const positions = plantPositions(languages.length)
  const crowdScale = languages.length >= 7 ? 0.9 : 1.0
  const recentByLang = recentHoursByLanguage(entries)
  const plants = languages.map((lang, i) => buildPlant(lang, {
    hours: hoursByLang[lang.id] || 0,
    recentHours: recentByLang[lang.id] || 0,
    lastWatered: lastByLang[lang.id] || null,
    todayStr,
    baseX: positions[i],
    index: i,
    count: languages.length,
    crowdScale,
    season: seasonName,
    bloomVariant,
  }))

  // ---- pressed-bloom beds at plants' feet ----
  const beds = pressed.map((p) => buildBed(p, p.languageId || p.id))

  // ---- sign ----
  const sign = buildSign(gardenName)

  // ---- companion ----
  const companionObj = buildCompanion(companion)

  // ---- bee flight path through specific flowers ----
  const beePath = buildBeePath(plants)

  // ---- stepping stones (a path through the garden bed) ----
  const steppingStones = buildSteppingStones()

  // ---- sky furniture + ground texture ----
  const celestial = celestialFor(hour)
  const clouds = buildClouds(skyRaw.band)
  const tufts = buildTufts()
  const foregroundBlades = buildForegroundBlades()
  const trees = buildTrees(seasonName)

  // ---- garden props: watering can, fence, autumn mushrooms ----
  const wateringCan = buildWateringCan(plants, lastByLang)
  const fence = buildFence()
  const mushrooms = buildMushrooms(seasonName, steppingStones)

  // ---- streak glow ----
  const fireflies = (streak >= 3 && skyRaw.band === 'night')
    ? Array.from({ length: 7 }, (_, i) => {
        const h = hashSeed('firefly-' + i)
        return {
          x: 60 + (h % 1080),
          y: GROUND_Y - 20 - ((h >>> 8) % 120),
          delay: ((h >>> 16) % 4000) / 1000,
        }
      })
    : []

  return {
    viewBox: { w: VIEW_W, h: VIEW_H },
    groundY: GROUND_Y,
    sky,
    season,
    plants,
    beds,
    sign,
    companion: companionObj,
    beePath,
    steppingStones,
    fireflies,
    celestial,
    clouds,
    tufts,
    foregroundBlades,
    trees,
    wateringCan,
    fence,
    mushrooms,
  }
}

// -- internal helpers ---------------------------------------------------------

// Even-slot scatter helper — guards every hashed-per-index element below
// (tufts, fringe, clouds, particles) against hashSeed's weak diffusion for
// keys sharing a long prefix that differ only in a trailing digit (e.g.
// 'tuft-0' vs 'tuft-1' hash to within ~1 of each other). Position comes
// from the slot index — always spread — and the hash only supplies a
// bounded in-slot jitter, so the result can't collapse into a cluster
// regardless of how poorly the hash disperses for a given key family.
// `i * salt` is mixed into every hash-derived field below it too (size,
// lean, delay...), for the same reason: shifted/masked hash bits alone
// repeat when the source hashes are this close together.
function slottedX(i, count, startX, span, h, jitterFrac = 0.4) {
  const slot = span / count
  const jitterMag = slot * jitterFrac
  const jitter = ((h % 1000) / 1000) * 2 * jitterMag - jitterMag
  return Math.round(startX + slot * (i + 0.5) + jitter)
}

function buildParticles(seasonName) {
  if (seasonName !== 'spring' && seasonName !== 'autumn') return []
  const kind = seasonName === 'spring' ? 'blossom' : 'leaf'
  const n = 5 + (hashSeed('particles-' + seasonName) % 4) // 5..8
  const span = 1140
  return Array.from({ length: n }, (_, i) => {
    const h = hashSeed('drift-' + seasonName + '-' + i)
    return {
      x: slottedX(i, n, 30, span, h, 0.5),
      y: 20 + (((h >>> 6) + i * 17) % 80),
      delay: (((h >>> 14) + i * 733) % 6000) / 1000,
      duration: 9 + (((h >>> 20) + i * 3) % 6), // 9..14s
      size: 2 + (((h >>> 4) + i * 2) % 3), // 2..4
      kind,
    }
  })
}

// Five soft clouds at hashed positions, drifting slowly. Sizes range from
// wispy (scale 0.5) to billowy (1.4) so the sky feels layered. Deterministic
// given the sky band (opacity drops at night so they read as dim shapes).
function buildClouds(band) {
  const count = 5
  const span = 920
  return Array.from({ length: count }, (_, i) => {
    const h = hashSeed('cloud-' + i)
    return {
      x: slottedX(i, count, 40, span, h, 0.5),
      y: 28 + (((h >>> 7) + i * 23) % 100), // 28..128 — more vertical spread
      scale: 0.5 + (((h >>> 13) + i * 3) % 8) * 0.125, // 0.5..1.375
      duration: 70 + (((h >>> 17) + i * 11) % 80), // 70..149s
      delay: ((h >>> 9) + i * 7) % 40,
      opacity: band === 'night' ? 0.1 : 0.5,
    }
  })
}

// Grass tufts scattered across the ground band so it reads as a garden bed,
// not a flat colour strip. Each tuft is a 3-blade fan (see fringeBladePath
// in GardenScene.vue) — bigger and fuller than the original 2-blade hairline,
// which read as sparse specks rather than grass.
function buildTufts() {
  const count = 20
  const span = 1152
  return Array.from({ length: count }, (_, i) => {
    const h = hashSeed('tuft-' + i)
    return {
      x: slottedX(i, count, 24, span, h),
      y: 6 + (((h >>> 8) + i * 13) % 22), // offset below groundY
      len: 8 + (((h >>> 5) + i * 5) % 8), // 8..15
      lean: (((h >>> 12) + i * 5) % 9) - 4, // -4..4
    }
  })
}

// Foreground fringe — small grass-tuft fans rooted near the very bottom
// edge, the same 3-blade shape buildTufts uses for the ground texture, just
// larger for the "closer to the viewer" foreground plane. Two earlier
// attempts overshot this: filled bulge peaks reached far enough to blot
// out plant labels, and single thin strokes read as bare sticks rather
// than grass.
function buildForegroundBlades() {
  const count = 12
  const span = 1120
  return Array.from({ length: count }, (_, i) => {
    const h = hashSeed('fringe-blade-' + i)
    return {
      x: slottedX(i, count, 40, span, h),
      len: 14 + (((h >>> 6) + i * 7) % 14), // 14..27
      lean: (((h >>> 13) + i * 5) % 9) - 4, // -4..4
    }
  })
}

// Distant silhouette trees on the far hill — 1 to 3 small round-canopy trees
// confined to the margins outside the planting band ([140, 1060]), so they
// fill the dead space between sky and planting row without ever standing in
// for (or crowding) a language's own plant. Season-tinted: bare branches in
// winter, warm ochre canopy in autumn, green otherwise.
const TREE_TINT = {
  spring: '#6cb87a',
  summer: '#3f8a52',
  autumn: '#c98a3e',
  winter: '#8a8a7a',
}
function buildTrees(seasonName) {
  const zones = [
    { start: 14, span: 100 },
    { start: 1086, span: 100 },
  ]
  const h0 = hashSeed('tree-count')
  const count = 1 + (h0 % 3) // 1..3
  // Zone comes from index, not a hash of 'tree-0'/'tree-1'/'tree-2' — those
  // keys are too similar for hashSeed to disperse (the same clustering bug
  // fixed elsewhere in this file), so multiple trees would land in the same
  // margin. Alternating by index guarantees a left/right split whenever
  // count > 1; the hash only supplies the in-zone x jitter and size.
  const startZone = (h0 >>> 4) % zones.length
  return Array.from({ length: count }, (_, i) => {
    const h = hashSeed('tree-' + i)
    const zone = zones[(startZone + i) % zones.length]
    const x = Math.round(zone.start + ((h % 1000) / 1000) * zone.span)
    const height = 16 + (((h >>> 9) + i * 7) % 12) // 16..27
    const canopyR = 7 + (((h >>> 13) + i * 3) % 5) // 7..11
    return {
      x,
      height,
      canopyR,
      bare: seasonName === 'winter',
      color: TREE_TINT[seasonName] || TREE_TINT.summer,
    }
  })
}

// A watering can beside the most-recently-tended plant — the metaphor the
// whole app runs on, made visible. Picks the language with the latest
// lastWatered date (ISO strings, lexically comparable) and anchors the can
// to that plant's x. Returns null when nothing has been logged yet.
function buildWateringCan(plants, lastByLang) {
  let bestId = null
  let bestDate = null
  for (const [langId, date] of Object.entries(lastByLang)) {
    if (!date) continue
    if (bestDate == null || date > bestDate) {
      bestDate = date
      bestId = langId
    }
  }
  if (bestId == null) return null
  const plant = plants.find((p) => p.id === bestId)
  if (!plant) return null
  const h = hashSeed('can-' + bestId)
  const side = h % 2 === 0 ? 1 : -1
  return { x: plant.x + side * 22 }
}

// A short run of fence pickets framing the far left/right edges of the band
// — company for the garden sign, and a quiet visual bookend for the planting
// row. Small and knee-high (rendered ~9 units tall, in line with the grass
// tufts and stones), not a landmark in their own right.
function buildFence() {
  const spacing = 7
  const pickets = []
  for (let i = 0; i < 3; i++) pickets.push({ x: 10 + i * spacing, side: 'left' })
  for (let i = 0; i < 3; i++) pickets.push({ x: 1190 - i * spacing, side: 'right' })
  return pickets
}

// Mushrooms beside one hashed stepping stone, autumn only — a small seasonal
// detail that gives returning users something new to notice without any new
// data reads.
function buildMushrooms(seasonName, stones) {
  if (seasonName !== 'autumn' || !stones.length) return []
  const pick = hashSeed('mushroom-stone')
  const stone = stones[pick % stones.length]
  const count = 1 + ((pick >>> 4) % 2) // 1..2
  return Array.from({ length: count }, (_, i) => {
    const h = hashSeed('mushroom-' + i)
    return {
      x: stone.x + (i === 0 ? -9 : 8) + ((h % 5) - 2),
      y: stone.y + 2,
      r: 2 + (h % 2),
    }
  })
}

// Stepping stones along a winding path through the garden. Six stones from
// left to right, with a gentle y-wave so the path meanders rather than
// marching in a straight line. Each stone is a small flat ellipse.
function buildSteppingStones() {
  const stones = []
  const baseX = 110
  const span = 980
  const count = 6
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const h = hashSeed('stone-' + i)
    const x = Math.round(baseX + t * span + ((h % 40) - 20))
    // Winding y: sine wave + tiny hash jitter so the path meanders
    const y = Math.round(5 + Math.sin(t * Math.PI * 2.3) * 4 + ((h >>> 8) % 3) - 1)
    const rx = 9 + ((h >>> 4) % 3) // 9..11
    const ry = 4 + ((h >>> 12) % 2) // 4..5
    const tilt = ((h >>> 16) % 9) - 4 // -4..4 degrees
    stones.push({ x, y, rx, ry, tilt })
  }
  return stones
}

// The SVG path string the bee flies along, visiting specific flowers. The
// path is a closed loop of quadratic curves that arc upward between
// flowers; the renderer feeds it into CSS `offset-path` so the bee follows
// it with a single linear `offset-distance` animation. When there are no
// flowers, returns null and the renderer falls back to the generic wander.
function buildBeePath(plants) {
  const flowers = plants.filter((p) => p.stage === 'bloom' || p.stage === 'flourish')
  if (flowers.length < 2) return null

  // Pick 2–4 flowers to visit. If there are many, spread the picks out so
  // the bee doesn't hop between adjacent plants.
  const visitCount = Math.min(4, Math.max(2, flowers.length))
  const visit = []
  if (flowers.length <= visitCount) {
    visit.push(...flowers)
  } else {
    const step = flowers.length / visitCount
    for (let i = 0; i < visitCount; i++) {
      visit.push(flowers[Math.floor(i * step)])
    }
  }

  // Hover positions: a touch above the flower's top petal.
  const positions = visit.map((p) => {
    const topY = GROUND_Y - STAGE_GEOM[p.stage].height * p.scale * PRESENCE
    return { x: p.x, y: topY - 18 }
  })

  // Build the path: start at the first flower, arc to each next via a
  // midpoint pulled upward, then close the loop back to start.
  const fmt = (n) => n.toFixed(1)
  let d = `M${fmt(positions[0].x)} ${fmt(positions[0].y)}`
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1]
    const cur = positions[i]
    const midX = (prev.x + cur.x) / 2
    const midY = Math.min(prev.y, cur.y) - 38
    d += ` Q${fmt(midX)} ${fmt(midY)} ${fmt(cur.x)} ${fmt(cur.y)}`
  }
  const last = positions[positions.length - 1]
  const first = positions[0]
  d += ` Q${fmt((last.x + first.x) / 2)} ${fmt(Math.min(last.y, first.y) - 38)} ${fmt(first.x)} ${fmt(first.y)} Z`

  return {
    d,
    duration: 18 + visitCount * 4, // 26..34s loop
  }
}

// "Spanish · 63h tended · 8h this week · in bloom · needs watering" — the
// hover title that gives each silhouette its meaning.
const STAGE_WORDS = {
  seedling: 'seedling',
  sprout: 'sprouting',
  bloom: 'in bloom',
  flourish: 'flourishing',
}

function fmtHours(h) {
  return h < 1 ? `${Math.round(h * 60)}m` : `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)}h`
}

function plantTitle(label, hours, stage, droop, recentHours) {
  const time = hours <= 0 ? 'just planted' : `${fmtHours(hours)} tended`
  const recent = recentHours > 0 ? ` · ${fmtHours(recentHours)} this week` : ''
  const thirst = droop ? ' · needs watering' : ''
  return `${label} · ${time}${recent} · ${STAGE_WORDS[stage]}${thirst}`
}

function buildPlant(lang, { hours, recentHours, lastWatered, todayStr, baseX, index, count, crowdScale, season, bloomVariant }) {
  const stage = growthStage(hours)
  const h = hashSeed(lang.id)
  const species = h % 4
  // Which seedling-stage cosmetic (see GardenPlant.vue's seedlingSilhouette):
  // a seed-packet marker on a stick, a seed peeking through the soil in the
  // language's own colour, or a wider mound with a first root-tip. A row of
  // 0-hour languages previously all rendered the same near-invisible sprig
  // in a shared season green — no language identity until first sprout.
  const seedVariant = (h >>> 17) % 3
  // Plants are perfectly vertical. Per-species tilt was a nice idea but it
  // made one language id out of many read as "broken" or "fallen over";
  // removing it is calmer and the silhouette already varies plenty.
  const tilt = 0
  const jitter = {
    leafSide: (h >>> 10) % 2 === 0 ? 1 : -1,
    petalCount: 5 + ((h >>> 3) % 3), // 5..7
    stretch: 0.94 + ((h >>> 12) % 3) * 0.06, // 0.94|1.0|1.06
    leafCount: 2 + ((h >>> 14) % 2), // 2..3
  }
  const yJitter = (((h >>> 18) % 13) - 6) // -6..6
  // x-jitter: ±12% of slot width, clamped so plants stay within the band
  const slotWidth = count > 1 ? 920 / count : 920
  const xJitterMag = slotWidth * 0.12
  const xJitter = (((h >>> 22) % 100) / 100) * 2 - 1 // -1..1
  const x = Math.round(baseX + xJitter * xJitterMag)

  // Within-stage size lerp × crowd × momentum. The stage (seedling/sprout/
  // bloom/flourish) still tracks total hours — that gives the plant its
  // silhouette. Momentum multiplies on top so a brand-new language with a
  // heavy recent week reads as a small shape, scaled up to feel alive;
  // a long-established language with no recent sessions reads as a big
  // shape, scaled down to feel neglected.
  const band = STAGE_BANDS.find((b) => b.name === stage) || STAGE_BANDS[0]
  const range = band.ceil - band.floor || 1
  const progress = Math.min(1, Math.max(0, (hours - band.floor) / range))
  const stageScale = clamp(0.85 + progress * 0.30, 0.85, 1.15)
  const scale = stageScale * crowdScale * momentumScale(recentHours)

  const droopDays = daysSinceNoon(lastWatered, todayStr)
  const droop = lastWatered != null && droopDays >= 7
  const droopDir = (h >>> 7) % 2 === 0 ? 1 : -1
  const droopTransform = droop
    ? `rotate(${8 * droopDir} ${x} ${GROUND_Y})`
    : null

  // bloomColor tints, never replaces: when the gardener has chosen a bloom
  // variant, every flower on this plant gets a small inner accent ring in
  // the chosen colour alongside its language-colour petals.
  const bloomColor = (bloomVariant != null && BLOOMS[bloomVariant])
    ? BLOOMS[bloomVariant]
    : null

  const swayDelay = (((h >>> 26) % 2000) / 1000) // 0..2s

  // Mix the season into the green tints this plant uses.
  const SEASON_LEAF = {
    spring: { stem: '#3f9a55', leaf: '#5cae6b', leafHi: '#7dc28a' },
    summer: { stem: '#287a41', leaf: '#389150', leafHi: '#5cae6b' },
    autumn: { stem: '#6a5a3a', leaf: '#7a8a4a', leafHi: '#a8a05a' },
    winter: { stem: '#5a6a5a', leaf: '#6a7a6a', leafHi: '#8a9a8a' },
  }
  const c = SEASON_LEAF[season] || SEASON_LEAF.summer

  // Nickname wins over the canonical name everywhere identity is displayed
  // (same rule as languageHorizons / pressedFlowers).
  const label = (typeof lang.nickname === 'string' && lang.nickname.trim())
    ? lang.nickname.trim()
    : lang.name

  return {
    id: lang.id,
    name: lang.name,
    label,
    title: plantTitle(label, hours, stage, droop, recentHours),
    color: lang.color,
    x,
    yJitter,
    species,
    seedVariant,
    stage,
    hours: Math.round(hours * 100) / 100,
    recentHours: Math.round(recentHours * 100) / 100,
    scale,
    droop,
    droopTransform,
    droopOpacity: droop ? 0.8 : 1.0,
    tilt,
    jitter,
    bloomColor,
    swayDelay: Math.round(swayDelay * 100) / 100,
    colors: c,
  }
}

function buildBed(pressed, languageId) {
  const h = hashSeed('bed-' + (languageId || pressed.id || ''))
  const side = (h >>> 4) % 2 === 0 ? 1 : -1
  // Recipe mirrors PressedFlower.vue's 5/6-petal fan; renderer just draws
  // the ellipses directly.
  const count = 5 + ((h >>> 2) % 2)
  const petals = Array.from({ length: count }, (_, i) => {
    const ang = ((h >>> (4 + i * 2)) % 9) - 4 // -4..4
    const reach = 5.4 + (((h >>> (12 + i)) % 3) - 1) * 0.5
    return { angleJitter: ang, reach }
  })
  return {
    id: pressed.id || languageId,
    color: pressed.color,
    side,
    petals,
  }
}

function buildSign(gardenName) {
  if (!gardenName || !gardenName.trim()) return null
  const text = gardenName.trim().length > 18
    ? gardenName.trim().slice(0, 17).replace(/\s+$/, '') + '…'
    : gardenName.trim()
  return { show: true, text, x: 60 }
}

function buildCompanion(companion) {
  if (companion == null) return null
  const meta = COMPANIONS[companion]
  if (!meta) return null
  const pathKind = (meta.name === 'bee' || meta.name === 'butterfly') ? 'air' : 'ground'
  return { kind: meta.name, pathKind }
}

// -- utilities ----------------------------------------------------------------

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }

// Cheap hex mix: blend each channel toward `target` by `amt` (0..1). Used for
// the winter sky cool-shift; doesn't need perceptual colour space for a 15%
// nudge.
function mixHex(hex, target, amt) {
  const a = parseInt(hex.slice(1, 3), 16)
  const b = parseInt(hex.slice(3, 5), 16)
  const c = parseInt(hex.slice(5, 7), 16)
  const t = parseInt(target.slice(1, 3), 16)
  const u = parseInt(target.slice(3, 5), 16)
  const v = parseInt(target.slice(5, 7), 16)
  const m = (x, y) => Math.round(x + (y - x) * amt)
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(m(a, t))}${toHex(m(b, u))}${toHex(m(c, v))}`
}

export const GARDEN_VIEW = { w: VIEW_W, h: VIEW_H, groundY: GROUND_Y }
export { STAGE_GEOM, SPECIES }
