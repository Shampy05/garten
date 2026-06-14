export function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

export function getQuarterRange(date) {
  const q = Math.floor(date.getMonth() / 3)
  const start = new Date(date.getFullYear(), q * 3, 1)
  const end = new Date(date.getFullYear(), q * 3 + 3, 0)
  return { start, end }
}

export function getYearRange(date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const end = new Date(date.getFullYear(), 11, 31)
  return { start, end }
}
