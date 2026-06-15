// Fluency Horizon — research-based proficiency targets.
//
// Target hours are derived from the US Foreign Service Institute (FSI) language
// difficulty categories: the approximate classroom hours a native English
// speaker needs to reach "Professional Working Proficiency" (roughly CEFR
// B2/C1). These are estimates, not promises — they exist to give logged hours a
// destination, not to be exact.

export const DEFAULT_TARGET_HOURS = 1100 // FSI Category III — the broad middle

// Only languages that differ from the Category III default are listed.
const TARGET_OVERRIDES = {
  // Category I — closely related to English (~750h)
  Afrikaans: 750,
  Danish: 750,
  Dutch: 750,
  French: 750,
  Italian: 750,
  Norwegian: 750,
  Portuguese: 750,
  Romanian: 750,
  Spanish: 750,
  Swedish: 750,
  // Category II (~900h)
  German: 900,
  'Haitian Creole': 900,
  Indonesian: 900,
  Malay: 900,
  Swahili: 900,
  // Category IV — "super-hard" (~2200h)
  Arabic: 2200,
  Chinese: 2200,
  Japanese: 2200,
  Korean: 2200,
}

export function targetHours(languageName) {
  return TARGET_OVERRIDES[languageName] ?? DEFAULT_TARGET_HOURS
}

// Starting-point levels. The fraction is the share of the proficiency target a
// learner has roughly already covered when entering at that level. This lets a
// user say "I'm about intermediate" instead of counting past hours.
export const LEVELS = [
  { key: 'none', label: 'Just starting', fraction: 0 },
  { key: 'a1', label: 'Beginner (A1)', fraction: 0.1 },
  { key: 'a2', label: 'Elementary (A2)', fraction: 0.22 },
  { key: 'b1', label: 'Intermediate (B1)', fraction: 0.45 },
  { key: 'b2', label: 'Upper-intermediate (B2)', fraction: 0.75 },
  { key: 'c1', label: 'Advanced (C1+)', fraction: 1.0 },
]

export function hoursForLevel(languageName, levelKey) {
  const level = LEVELS.find((l) => l.key === levelKey)
  if (!level) return 0
  return Math.round(targetHours(languageName) * level.fraction)
}

// Given an hour offset, return the closest matching level key — used to
// re-display a stored prior_hours value as a level in the editor.
export function levelForHours(languageName, hours) {
  const h = Number(hours) || 0
  if (h <= 0) return 'none'
  let best = LEVELS[0]
  let bestDiff = Infinity
  for (const level of LEVELS) {
    const diff = Math.abs(hoursForLevel(languageName, level.key) - h)
    if (diff < bestDiff) {
      bestDiff = diff
      best = level
    }
  }
  return best.key
}

// Estimate months remaining at a given weekly pace (hours/week).
// Returns null when there isn't enough signal to forecast.
export function forecastMonths(remainingHours, weeklyPaceHours) {
  if (remainingHours <= 0) return 0
  if (!weeklyPaceHours || weeklyPaceHours <= 0) return null
  const weeks = remainingHours / weeklyPaceHours
  return weeks / 4.345 // avg weeks per month
}

// --- Trend-aware pace -------------------------------------------------------
//
// A flat N-day average has two problems: a single session ageing out of the
// window makes the ETA jump (whipsaw), and it can't tell someone ramping up
// from someone winding down. Instead we look back over a longer window and
// weight recent days more heavily with exponential decay — no hard cliff, and
// the pace tracks current behaviour.

export const PACE_WINDOW_DAYS = 56 // 8 weeks of context
export const PACE_HALF_LIFE_DAYS = 14 // a day's contribution halves every 2 weeks

// minutesByAge: array indexed by days-ago (0 = today) holding minutes logged
// that day. Returns an exponentially-weighted pace in hours per week.
export function weightedWeeklyPace(minutesByAge) {
  const tau = PACE_HALF_LIFE_DAYS / Math.LN2
  let weightSum = 0
  let weightedMinutes = 0
  for (let age = 0; age < PACE_WINDOW_DAYS; age++) {
    const w = Math.exp(-age / tau)
    weightSum += w
    weightedMinutes += w * (minutesByAge[age] || 0)
  }
  if (weightSum === 0) return 0
  const weightedDailyMinutes = weightedMinutes / weightSum
  return (weightedDailyMinutes * 7) / 60
}

// Momentum: total minutes in the most recent 4 weeks vs the 4 weeks before,
// as a signed ratio (e.g. 0.2 = pace up 20%). Returns null when there isn't a
// prior-period baseline to compare against (a fresh ramp-up has no "before").
export function paceMomentum(minutesByAge) {
  const half = PACE_WINDOW_DAYS / 2
  let recent = 0
  let prior = 0
  for (let age = 0; age < PACE_WINDOW_DAYS; age++) {
    const m = minutesByAge[age] || 0
    if (age < half) recent += m
    else prior += m
  }
  if (prior <= 0) return null
  return (recent - prior) / prior
}
