// Spaced-repetition scheduling for the Word Garden — a fixed-interval Leitner
// ladder. Deliberately simpler than SM-2: no floating-point ease factor to
// persist or drift, just a stage (0–6) indexing into SRS_INTERVALS. The jumps
// are coarse but the research effect (spacing + active recall) comes from the
// schedule existing at all, not from per-word ease tuning.
//
// All date math runs on localDateStr (local timezone). Do NOT swap in
// toISOString().slice(0, 10) — that's UTC, and words would fall due an hour
// early/late around midnight for non-UTC users.
//
// Growth staging deliberately echoes the avatar's seed→sprout→bloom→flourish
// arc (src/lib/avatar.js) but maps from SRS stage, not hours — a word blooms
// by surviving reviews.

import { localDateStr } from './date.js'

// Days until the next review, per stage. Stage 0 is "due today" — brand-new
// words and lapsed words recycle within the same session.
export const SRS_INTERVALS = [0, 1, 3, 7, 14, 30, 90]
export const MAX_STAGE = SRS_INTERVALS.length - 1
export const GRADES = ['again', 'good', 'easy']

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

// Apply one review grade to a word. Pure — returns the updated SRS fields for
// the caller to merge/persist:
//   again → drop two stages (floor 0), count a lapse; the word is due today
//           regardless of the landing stage — classic Leitner "back to box
//           one," not a partial credit on the ladder. (A word dropping from
//           stage 5 to 3 should resurface today, not ride out stage 3's
//           7-day interval — that would barely distinguish it from a Good.)
//   good  → up one stage.
//   easy  → up two stages (a word you know cold skips ahead).
export function reviewWord(word, grade, today = localDateStr(new Date())) {
  const stage = Number(word?.stage) || 0
  let nextStage
  let lapses = Number(word?.lapses) || 0
  if (grade === 'again') {
    nextStage = Math.max(0, stage - 2)
    lapses += 1
  } else if (grade === 'easy') {
    nextStage = Math.min(MAX_STAGE, stage + 2)
  } else {
    nextStage = Math.min(MAX_STAGE, stage + 1)
  }
  return {
    stage: nextStage,
    dueDate: grade === 'again' ? today : addDays(today, SRS_INTERVALS[nextStage]),
    lapses,
    reviewCount: (Number(word?.reviewCount) || 0) + 1,
    lastReviewedAt: today,
  }
}

export function isDue(word, today = localDateStr(new Date())) {
  return Boolean(word?.dueDate) && word.dueDate <= today
}

// Due words for a review session: most overdue first, ties broken toward the
// lower stage (shakier words first), then oldest planting for determinism.
export function dueWords(words = [], today = localDateStr(new Date())) {
  return words
    .filter((w) => isDue(w, today))
    .sort(
      (a, b) =>
        String(a.dueDate).localeCompare(String(b.dueDate)) ||
        (Number(a.stage) || 0) - (Number(b.stage) || 0) ||
        String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    )
}

export function countDue(words = [], today = localDateStr(new Date())) {
  let n = 0
  for (const w of words) if (isDue(w, today)) n += 1
  return n
}

// SRS stage → growth stage for the word's glyph.
export function vocabGrowthStage(word) {
  const stage = Number(word?.stage) || 0
  if (stage >= MAX_STAGE) return 'flourish'
  if (stage >= 4) return 'bloom'
  if (stage >= 2) return 'sprout'
  return 'seed'
}

// Tally a session's grades for the end-of-session summary.
export function sessionSummary(grades = []) {
  const out = { reviewed: grades.length, again: 0, good: 0, easy: 0 }
  for (const g of grades) {
    if (g in out) out[g] += 1
  }
  return out
}
