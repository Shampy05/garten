// Milestone moments — detect a threshold the user just crossed by logging a
// session, so stats feed back as a quiet celebration instead of sitting inert.
//
// Pure diff between two snapshots (before/after the add); returns the single
// most meaningful milestone, or null. One toast, never a pile — matching the
// app's "no loud celebrations" register. The caller builds the snapshots from
// its own reactive state (see milestoneSnapshot in App.vue).

import { LEVELS } from './proficiency.js'
import { STAGE_RANK } from './avatar.js'

const LEVEL_ORDER = ['none', 'a1', 'a2', 'b1', 'b2', 'c1']
const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.key, l.label]))
// `bloom` is rank 2 in STAGE_RANK (seedling=0, sprout=1, bloom=2, flourish=3).
const BLOOM_RANK = STAGE_RANK.bloom

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
//   {
//     streak, weekReached,
//     langs: { [id]: { name, hours, level, stageRank, firstBloomAt } },
//   }
// where `hours` is LOGGED hours (prior-hours credit excluded, so a starting
// credit can't instantly "cross" an hours rung), `level` is the CEFR key
// from prior+logged (a level-up only fires when logging pushes across a
// border), `stageRank` is the growth stage as a number (so we can detect a
// stage transition), and `firstBloomAt` is the persisted timestamp that
// gates the first-bloom celebration to one firing per language.
export function detectMilestone(before, after) {
  if (!before || !after) return null

  // 1. First bloom — a language just crossed into the `bloom` growth stage
  //    for the first time. This is the most visually striking moment (the
  //    avatar visibly grows a flower) so it leads. `firstBloomAt == null`
  //    is the gate: the caller writes the timestamp after the milestone
  //    fires, so a second crossing attempt is a no-op.
  for (const id of Object.keys(after.langs)) {
    const a = after.langs[id]
    const b = before.langs[id]
    if (!b) continue // no real "before" to cross from
    if (a.firstBloomAt == null && a.stageRank >= BLOOM_RANK && b.stageRank < BLOOM_RANK) {
      return { kind: 'first_bloom', langId: id, message: `Your ${a.name} just bloomed.` }
    }
  }

  // 2. CEFR level-up — the proudest of the "logged-hours" milestones.
  //    Pick the most advanced crossing.
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

  // 3. Streak rung.
  const streak = highestCrossed(STREAK_RUNGS, before.streak || 0, after.streak || 0)
  if (streak) {
    return { kind: 'streak', message: `A ${streak}-day streak — beautifully consistent.` }
  }

  // 4. Per-language logged-hours rung (highest across languages).
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

  // 5. Weekly goal just completed.
  if (!before.weekReached && after.weekReached) {
    return { kind: 'goal', message: 'Weekly goal reached — lovely work.' }
  }

  return null
}
