// Reading-progress analytics: pace, streak, and finish predictions.
// Pure functions so they can be unit-tested without UI or Supabase state.

const MS_PER_DAY = 24 * 60 * 60 * 1000

function localDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

/**
 * Pages per day over the last `windowDays`, weighted so recent days count
 * more. Bucketed by calendar day first (same day-bucketed exponential-decay
 * pattern as `weightedWeeklyPace` in proficiency.js) and averaged over every
 * day in the window, not just days with a session — otherwise a single big
 * session surrounded by off-days reads as a sustained daily pace instead of
 * an occasional binge, badly overestimating how fast the book will be
 * finished. Returns 0 if there is no history.
 */
export function weightedPace(sessions = [], windowDays = 28, halfLifeDays = 7) {
  const cutoff = new Date(Date.now() - windowDays * MS_PER_DAY)
  const pagesByDay = new Map()
  for (const s of sessions) {
    if (!s.date) continue
    const d = new Date(s.date + 'T00:00:00')
    if (d < cutoff) continue
    pagesByDay.set(s.date, (pagesByDay.get(s.date) || 0) + (s.pagesRead || 0))
  }

  const lambda = Math.log(2) / halfLifeDays
  let weightedPages = 0
  let weightSum = 0
  for (let age = 0; age < windowDays; age++) {
    const key = localDateKey(new Date(Date.now() - age * MS_PER_DAY))
    const weight = Math.exp(-lambda * age)
    weightedPages += weight * (pagesByDay.get(key) || 0)
    weightSum += weight
  }

  if (weightSum <= 0) return 0
  return weightedPages / weightSum
}

/**
 * Consecutive days with at least one reading session, ending today or yesterday.
 */
export function readingStreak(sessions = []) {
  if (!sessions.length) return 0
  const days = new Set(sessions.map((s) => s.date).filter(Boolean))
  let streak = 0
  const today = localDateKey()
  const yesterday = localDateKey(new Date(Date.now() - MS_PER_DAY))
  if (!days.has(today) && !days.has(yesterday)) return 0

  for (let i = 0; i < 365; i++) {
    const d = localDateKey(new Date(Date.now() - i * MS_PER_DAY))
    if (days.has(d)) {
      streak += 1
    } else if (i > 0) {
      break
    }
  }
  return streak
}

/**
 * Predicted finish date from current page, total pages, and pace.
 * Returns null if already finished or pace is zero.
 */
export function predictedFinish(currentPage, totalPages, pace) {
  if (!totalPages || currentPage >= totalPages || pace <= 0) return null
  const remaining = totalPages - currentPage
  const days = remaining / pace
  const d = new Date()
  d.setDate(d.getDate() + Math.max(1, Math.ceil(days)))
  return d
}

export function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function pct(currentPage, totalPages) {
  if (!totalPages || totalPages <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)))
}

/**
 * Days since the most recent session date. 0 = today, null = no sessions.
 */
export function lastReadDaysAgo(sessions = []) {
  let latest = null
  for (const s of sessions) {
    if (!s.date) continue
    if (latest == null || s.date > latest) latest = s.date
  }
  if (latest == null) return null
  const today = new Date(localDateKey() + 'T00:00:00')
  const last = new Date(latest + 'T00:00:00')
  return Math.max(0, Math.round((today - last) / MS_PER_DAY))
}

/**
 * "~12 pages/day" | "~1 page/day" | "<1 page/day" | '' when pace <= 0.
 */
export function formatPace(pace) {
  if (!pace || pace <= 0) return ''
  const rounded = Math.round(pace)
  if (rounded < 1) return '<1 page/day'
  return `~${rounded} page${rounded === 1 ? '' : 's'}/day`
}

/**
 * Everything the Reading-shelf spotlight card needs, derived from the
 * bulk-loaded reading_progress rows (this book's only) + the book's record.
 */
export function bookPaceStats(sessions = [], record = null) {
  const currentPage = Number(record?.currentPage) || 0
  const totalPages = Number(record?.totalPages) || 0
  const pace = weightedPace(sessions)
  return {
    pace, // float, 0 when no recent history
    hasSessions: sessions.length > 0, // distinguishes "never" from "stale"
    finishDate: predictedFinish(currentPage, totalPages, pace), // Date|null
    pctRead: pct(currentPage, totalPages), // 0–100 int
    pagesLeft: totalPages ? Math.max(0, totalPages - currentPage) : null,
    lastReadDaysAgo: lastReadDaysAgo(sessions), // int|null
  }
}
