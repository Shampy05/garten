// Milestone moments — detect a threshold the user just crossed by logging a
// session, so stats feed back as a quiet celebration instead of sitting inert.
//
// Pure diff between two snapshots (before/after the add); returns the single
// most meaningful milestone, or null. One toast, never a pile — matching the
// app's "no loud celebrations" register. The caller builds the snapshots from
// its own reactive state (see milestoneSnapshot in App.vue).

import { LEVELS } from './proficiency.js'

const LEVEL_ORDER = ['none', 'a1', 'a2', 'b1', 'b2', 'c1']
const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.key, l.label]))

// Rungs, high → low, so the highest freshly-crossed one wins.
const STREAK_RUNGS = [365, 180, 100, 30, 14, 7]
const HOUR_RUNGS = [1000, 500, 250, 100, 50, 25]

function highestCrossed(rungs, before, after) {
  for (const r of rungs) {
    if (before < r && after >= r) return r
  }
  return null
}

// Snapshot shape:
//   { streak, weekReached, langs: { [id]: { name, hours, level } } }
// where `hours` is LOGGED hours (prior-hours credit excluded, so a starting
// credit can't instantly "cross" an hours rung) and `level` is the CEFR key
// from prior+logged (a level-up only fires when logging pushes across a border).
export function detectMilestone(before, after) {
  if (!before || !after) return null

  // 1. CEFR level-up — the proudest, so it leads. Pick the most advanced crossing.
  let bestLevel = null
  for (const id of Object.keys(after.langs)) {
    const a = after.langs[id]
    const b = before.langs[id]
    if (!b) continue // no real "before" to cross from — not a level-up
    const ai = LEVEL_ORDER.indexOf(a.level)
    const bi = LEVEL_ORDER.indexOf(b.level)
    if (ai > bi && ai >= LEVEL_ORDER.indexOf('a1')) {
      if (!bestLevel || ai > bestLevel.ai) bestLevel = { name: a.name, level: a.level, ai }
    }
  }
  if (bestLevel) {
    return { kind: 'level', message: `${bestLevel.name} reached ${LEVEL_LABEL[bestLevel.level]}.` }
  }

  // 2. Streak rung.
  const streak = highestCrossed(STREAK_RUNGS, before.streak || 0, after.streak || 0)
  if (streak) {
    return { kind: 'streak', message: `A ${streak}-day streak — beautifully consistent.` }
  }

  // 3. Per-language logged-hours rung (highest across languages).
  let bestHours = null
  for (const id of Object.keys(after.langs)) {
    const a = after.langs[id]
    const b = before.langs[id]
    const rung = highestCrossed(HOUR_RUNGS, b ? b.hours : 0, a.hours)
    if (rung && (!bestHours || rung > bestHours.rung)) bestHours = { rung, name: a.name }
  }
  if (bestHours) {
    return { kind: 'hours', message: `${bestHours.rung} hours in ${bestHours.name}.` }
  }

  // 4. Weekly goal just completed.
  if (!before.weekReached && after.weekReached) {
    return { kind: 'goal', message: 'Weekly goal reached — lovely work.' }
  }

  return null
}
