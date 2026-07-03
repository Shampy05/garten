// Language palette.
//
// Ten vivid hues spread around the color wheel, each with a contrast ratio of
// at least 3:1 against the white UI so dots and intensity fills stay legible
// (no washed-out yellows). Ten is roughly the ceiling at which colors stay
// reliably distinct — including under color blindness — so nextColor() assigns
// by maximum hue separation, keeping the first handful of languages (the common
// case) far apart and deferring the closer hues until many are in play.
export const PALETTE = [
  '#2563eb', // blue
  '#4f46e5', // indigo
  '#7c3aed', // violet
  '#a21caf', // fuchsia
  '#e11d48', // rose
  '#d97706', // amber
  '#65a30d', // lime
  '#16a34a', // green
  '#0d9488', // teal
  '#0284c7'  // sky
]

function hexToRgb(hex) {
  const h = toHexColor(hex)
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16)
  ]
}

// sRGB-space approximations of normal vision plus the two common red-green
// color-vision deficiencies. Used to measure the *worst-case* separation.
const CB_MATRICES = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],        // deuteranopia
  [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]] // protanopia
]

function simulate(rgb, m) {
  return m.map(row =>
    Math.max(0, Math.min(255, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))
  )
}

// Low-cost perceptual ("redmean") distance between two RGB triples.
function redmean(a, b) {
  const rmean = (a[0] + b[0]) / 2
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  )
}

// Colorblind-aware distance: the smallest separation across normal vision and
// the two red-green deficiencies. Bigger = more reliably distinguishable.
export function colorDistance(a, b) {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return Math.min(...CB_MATRICES.map(m => redmean(simulate(x, m), simulate(y, m))))
}

// Hue angle (0–360) of a color.
export function hueOf(hex) {
  const [r0, g0, b0] = hexToRgb(hex)
  const r = r0 / 255, g = g0 / 255, b = b0 / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  if (d === 0) return 0
  let h
  if (mx === r) h = ((g - b) / d + 6) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return h * 60
}

// Smallest angular distance between two hues (0–180).
export function hueGap(a, b) {
  const d = Math.abs(hueOf(a) - hueOf(b))
  return Math.min(d, 360 - d)
}

// Pick the next language color. Among the colors not already in use, choose the
// one whose hue is furthest from every hue already taken (so we spread around
// the wheel and never land on a second "green" or "blue" while a distinct hue
// is free), breaking ties by colorblind-aware distance. Once the palette is
// exhausted it falls back to the whole palette, still maximizing separation.
export function nextColor(existingColors) {
  const used = (existingColors || []).map(c => c?.toLowerCase()).filter(Boolean)
  const usedSet = new Set(used)
  const unused = PALETTE.filter(c => !usedSet.has(c.toLowerCase()))
  const pool = unused.length ? unused : PALETTE

  if (used.length === 0) return pool[0]

  let best = pool[0]
  let bestHue = -1
  let bestDist = -1
  for (const c of pool) {
    const minHue = Math.min(...used.map(u => hueGap(c, u)))
    const minDist = Math.min(...used.map(u => colorDistance(c, u)))
    if (minHue > bestHue + 0.5 || (Math.abs(minHue - bestHue) <= 0.5 && minDist > bestDist)) {
      bestHue = minHue
      bestDist = minDist
      best = c
    }
  }
  return best
}

export function toHexColor(color) {
  if (!color) return PALETTE[0]
  if (color.startsWith('#') && color.length === 7) return color
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return PALETTE[0]
  const h = parseInt(match[1]) / 360
  const s = parseInt(match[2]) / 100
  const l = parseInt(match[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

const lighten = (v, amt) => Math.min(255, Math.round(v + (255 - v) * amt))
const darken = (v, amt) => Math.max(0, Math.round(v * (1 - amt)))

export function lightenColor(color, amount = 0.35) {
  const hex = toHexColor(color)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${lighten(r, amount)}, ${lighten(g, amount)}, ${lighten(b, amount)})`
}

export function darkenColor(color, amount = 0.15) {
  const hex = toHexColor(color)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${darken(r, amount)}, ${darken(g, amount)}, ${darken(b, amount)})`
}

// Build a glossy gradient from a flat language color. The light catch at the
// top-left and the deeper shade at the bottom-right make mosaic tiles feel
// like polished seed-packet gems while keeping the language identity intact.
export function glossyGradient(color, { lightenAmount = 0.35, darkenAmount = 0.15 } = {}) {
  const base = toHexColor(color)
  return `linear-gradient(145deg, ${lightenColor(base, lightenAmount)} 0%, ${base} 55%, ${darkenColor(base, darkenAmount)} 100%)`
}
