export const PALETTE = [
  '#16a34a',
  '#2563eb',
  '#dc2626',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#e11d48',
  '#65a30d'
]

export function nextColor(existingColors) {
  const used = new Set(existingColors.map(c => c.toLowerCase()))
  const available = PALETTE.filter(c => !used.has(c.toLowerCase()))
  return available[0] || PALETTE[existingColors.length % PALETTE.length]
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
