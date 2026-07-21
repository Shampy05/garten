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

import { localDateStr, daysBetween } from './date.js'

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

// Which of the Word Garden's three resting-list decks a word belongs in —
// disjoint and exhaustive over `reviewCount`, not stage/due-date:
//   'new'    → never graded (reviewCount === 0). Always also due (a fresh
//              word's dueDate is always today — see useVocab.addWord), but
//              shown here instead of 'due' so first-time and returning
//              words read as two different things, the way most SRS apps
//              distinguish "new" from "review" cards.
//   'due'    → graded before, and due again right now.
//   'mature' → graded before, resting on its interval.
//
// Deliberately NOT gated on stage: a word that lapsed hard enough to floor
// back to stage 0 (two "again"s from stage 1) has reviewCount > 0 — it's a
// struggling returning word, not a fresh seed, and belongs in 'due', not
// 'new'. reviewCount === 0 is guaranteed to mean stage === 0 too (the two
// only ever change together, in reviewWord), so callers rendering a 'new'
// word's growth glyph can safely assume the seed stage.
//
// This does NOT change what counts as "due" for scheduling — isDue()/
// dueWords() still correctly treat a brand-new word as due today, so the
// main Review/Quick water flows pick it up regardless of which deck it
// displays in. This only decides how the resting list groups words.
export function wordDeck(word, today = localDateStr(new Date())) {
  if ((Number(word?.reviewCount) || 0) === 0) return 'new'
  return isDue(word, today) ? 'due' : 'mature'
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

// Once a word reaches "bloom" (stage 4, a 14-day+ interval) it only ever
// resurfaces on its exact due date — up to 90 days apart at the top of the
// ladder — and otherwise quietly fossilizes. `rediscoverPick` offers one
// NOT-due bloom/flourish word as an optional early peek, for the moments
// there's nothing left due (see WordGardenView, gated on dueCount === 0).
export const REDISCOVER_MIN_STAGE = 4
const REDISCOVER_POOL = 3 // rotate across the N most-neglected, not always the same word

function daysSinceEpoch(today) {
  return Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000)
}

// Most-neglected first (oldest lastReviewedAt, i.e. longest since it was
// last touched; ties broken toward the higher stage — the ones with the
// longest intervals ahead of them). Rotates daily across the top
// REDISCOVER_POOL candidates so a visit-every-day gardener doesn't just
// see the same single word forever (mirrors discover.js's
// daysSinceEpoch-modulo rotation for "More by <author>").
export function rediscoverPick(words = [], today = localDateStr(new Date())) {
  const candidates = words
    .filter((w) => !isDue(w, today) && (Number(w.stage) || 0) >= REDISCOVER_MIN_STAGE)
    .sort(
      (a, b) =>
        String(a.lastReviewedAt || '').localeCompare(String(b.lastReviewedAt || '')) ||
        (Number(b.stage) || 0) - (Number(a.stage) || 0)
    )
  if (!candidates.length) return null
  const pool = candidates.slice(0, REDISCOVER_POOL)
  return pool[daysSinceEpoch(today) % pool.length]
}

// Days from today until a word's next review — negative/zero for an overdue
// or due-today word (decks route those into "Due today" rather than here),
// positive for a word still resting on its interval. Used for the Mature
// deck's quiet "back in Nd" temporal caption.
export function daysUntilDue(word, today = localDateStr(new Date())) {
  if (!word?.dueDate) return null
  return daysBetween(today, word.dueDate)
}

// How far a word has traveled through its current interval (0–100), for a
// quiet progress hairline under mature words: the span from its last review
// to its next due date, and where today sits within that span. A word with
// no review yet (no lastReviewedAt) has no interval to show progress
// through — returns null. A same-day span (dueDate === lastReviewedAt, only
// possible right after an "again") is treated as fully elapsed.
export function intervalProgress(word, today = localDateStr(new Date())) {
  if (!word?.lastReviewedAt || !word?.dueDate) return null
  const span = daysBetween(word.lastReviewedAt, word.dueDate)
  if (span <= 0) return 100
  const elapsed = daysBetween(word.lastReviewedAt, today)
  return Math.max(0, Math.min(100, (elapsed / span) * 100))
}

// Tally a session's grades for the end-of-session summary.
export function sessionSummary(grades = []) {
  const out = { reviewed: grades.length, again: 0, good: 0, easy: 0 }
  for (const g of grades) {
    if (g in out) out[g] += 1
  }
  return out
}
