// Pure view-model math for the Word Garden's "state of the garden" hero —
// a glanceable summary above the capture form and word list. Everything here
// reads only fields useVocab already holds in memory (stage, dueDate,
// lastReviewedAt) — no new Supabase reads, no schema change.

import { vocabGrowthStage } from './srs.js'
import { localDateStr, daysBetween } from './date.js'

const STAGES = ['seed', 'sprout', 'bloom', 'flourish']
const STAGE_LABELS = { seed: 'Seed', sprout: 'Sprout', bloom: 'Bloom', flourish: 'Flourish' }
// A single garden hue at stepped opacity, growing more solid as a word
// matures — same "one hue, more density" idiom as ActivityGoals.vue's
// BAR_OPACITIES, applied in growth order instead of goal-progress order.
const STAGE_OPACITY = { seed: 0.25, sprout: 0.5, bloom: 0.75, flourish: 1 }
const STAGE_COLOR = (stage) => `rgba(22, 163, 74, ${STAGE_OPACITY[stage]})`

// Growth-stage distribution across the whole collection — segmented-bar data
// in the same shape as the weekly-goal bar's segments (percent + count per
// bucket), ordered youngest-to-most-established so the bar reads left to
// right as growth. Always returns all four stages (zero-count segments just
// render at 0% width); callers filter for the text legend.
export function stageDistribution(words = []) {
  const counts = { seed: 0, sprout: 0, bloom: 0, flourish: 0 }
  for (const w of words) counts[vocabGrowthStage(w)] += 1
  const total = words.length
  return STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: counts[stage],
    percent: total > 0 ? (counts[stage] / total) * 100 : 0,
    color: STAGE_COLOR(stage),
  }))
}

// Due forecast — how many words are due right now (today or earlier),
// tomorrow, and later this week (2–7 days out). A word overdue from a missed
// day still counts under "today", since it's due the moment the gardener
// opens the tab. Words further out than 7 days aren't bucketed — the
// forecast is meant to answer "what does the next week look like", not
// project the full ladder.
export function dueForecast(words = [], today = localDateStr(new Date())) {
  let dueToday = 0
  let dueTomorrow = 0
  let dueThisWeek = 0
  for (const w of words) {
    if (!w?.dueDate) continue
    const diff = daysBetween(today, w.dueDate)
    if (diff <= 0) dueToday += 1
    else if (diff === 1) dueTomorrow += 1
    else if (diff <= 7) dueThisWeek += 1
  }
  return { dueToday, dueTomorrow, dueThisWeek }
}

// Words watered (reviewed) today — the simplest possible "today's trace"
// signal, purely derived from lastReviewedAt. Deliberately does not attempt
// to count stage-crossings ("N reached bloom") — that needs live session
// state (which stage a word was at *before* today's grade), not just the
// persisted end state, so it's left for the review-session wiring rather
// than reconstructed here.
export function wateredToday(words = [], today = localDateStr(new Date())) {
  return words.filter((w) => w?.lastReviewedAt === today).length
}
