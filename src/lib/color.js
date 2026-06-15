// Language palette.
//
// Based on the Okabe-Ito qualitative palette, which is designed to stay
// distinguishable under the common forms of color blindness (deuteranopia,
// protanopia, tritanopia). Pure black is softened to a dark slate so the dots
// and intensity fills sit comfortably on the light UI. nextColor() then assigns
// by maximum perceptual distance, so even a handful of languages get colors
// that are far apart rather than, say, two greens.
export const PALETTE = [
  '#0072b2', // blue
  '#e69f00', // orange
  '#009e73', // bluish green
  '#cc79a7', // reddish purple
  '#d55e00', // vermillion
  '#56b4e9', // sky blue
  '#f0e442', // yellow
  '#525252'  // neutral dark
]

function hexToRgb(hex) {
  const h = toHexColor(hex)
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16)
  ]
}

// Perceptual-ish distance between two colors (the "redmean" low-cost
// approximation). Bigger = more visually different. Good enough to keep
// auto-assigned colors apart without pulling in a full CIELAB dependency.
export function colorDistance(a, b) {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const rmean = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  )
}

// Pick the next language color: the unused palette entry that is most distant
// from every color already in use. Falls back to the most-distant palette entry
// overall once the palette is exhausted, so reuse still favors contrast.
export function nextColor(existingColors) {
  const used = (existingColors || []).map(c => c?.toLowerCase()).filter(Boolean)
  const usedSet = new Set(used)
  const unused = PALETTE.filter(c => !usedSet.has(c.toLowerCase()))
  const pool = unused.length ? unused : PALETTE

  if (used.length === 0) return pool[0]

  let best = pool[0]
  let bestScore = -Infinity
  for (const c of pool) {
    let minD = Infinity
    for (const u of used) minD = Math.min(minD, colorDistance(c, u))
    if (minD > bestScore) {
      bestScore = minD
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
