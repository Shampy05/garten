// Bloom avatars — deterministic generative plant parameters.
//
// Every gardener gets a small SVG plant instead of a letter avatar. The shape
// (bloom colour, petal count, tilt, leaf side) is derived from a stable id via
// a hash, so the same person looks the same everywhere with no stored state.
// The growth stage is driven by total logged hours, making the avatar itself
// a quiet feedback loop: your plant grows as you tend your garden.

export function hashSeed(seed) {
  // djb2 (xor variant) — tiny, stable, good-enough dispersion for cosmetics.
  const s = String(seed ?? '')
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0
  }
  return h
}

// Bloom colours sit in the warm, muted register of the Garden Journal palette
// so they read on white and garden-50 backgrounds without shouting.
//
// Nine entries (the CHECK constraint on profiles.avatar_variant allows 0..8):
// the original six — rose, coral, amber, lilac, sky, blush — plus sage, plum,
// and cream. The new three close tonal gaps: sage is a desaturated cool that
// stays distinct from the leaf green (#389150 / #5cae6b), plum is a deeper
// cool, and cream is a warm light (cherry-blossom-ish). Index 0..N maps
// straight onto the picker swatch order in the GardenerProfile modal.
export const BLOOMS = [
  { name: 'rose', petal: '#e2a0ad', center: '#b95c72' },
  { name: 'coral', petal: '#eda98f', center: '#c96a4a' },
  { name: 'amber', petal: '#e6c26e', center: '#b8862e' },
  { name: 'lilac', petal: '#bfa8dc', center: '#8568b4' },
  { name: 'sky', petal: '#9ec2df', center: '#5583ad' },
  { name: 'blush', petal: '#dfb1c8', center: '#a86489' },
  { name: 'sage', petal: '#b8c4a8', center: '#7a8a6a' },
  { name: 'plum', petal: '#b88aae', center: '#7d3a64' },
  { name: 'cream', petal: '#ede4ce', center: '#c4a55a' },
]

export const STAGES = ['seedling', 'sprout', 'bloom', 'flourish']

// Total-logged-hours thresholds for each growth stage. Logged hours only —
// the avatar reflects the garden tended here, not prior experience credit.
export const STAGE_HOURS = { sprout: 10, bloom: 50, flourish: 250 }

export function growthStage(hours) {
  // Unknown hours (friends — we only see safe aggregates, never totals):
  // show the fully-grown public face rather than a misleading seedling.
  if (hours == null) return 'bloom'
  if (hours >= STAGE_HOURS.flourish) return 'flourish'
  if (hours >= STAGE_HOURS.bloom) return 'bloom'
  if (hours >= STAGE_HOURS.sprout) return 'sprout'
  return 'seedling'
}

// Numeric rank for the growth stage, so callers can do "did we just cross
// into bloom" by comparing ranks. `seedling` is 0, `bloom` is 2.
export const STAGE_RANK = { seedling: 0, sprout: 1, bloom: 2, flourish: 3 }
export function stageRank(stage) {
  return STAGE_RANK[stage] ?? 0
}

export function avatarParams(seed) {
  const h = hashSeed(seed)
  return {
    bloom: BLOOMS[h % BLOOMS.length],
    petals: 5 + ((h >>> 3) % 3), // 5–7
    tilt: ((h >>> 6) % 13) - 6, // -6…6 degrees
    leafSide: (h >>> 10) % 2 === 0 ? 1 : -1,
    petalStretch: 0.92 + ((h >>> 12) % 3) * 0.08, // 0.92 | 1.0 | 1.08
  }
}
