// "Today's seed" — a single next-best-action for the garden header.
//
// A priority ladder over data the app already holds: the first applicable rung
// wins, so the user always sees exactly one gentle, specific suggestion rather
// than a to-do list. Pure and deterministic; the caller maps `tone` + `icon`
// to styling. Never returns null — when everything's tended it returns a calm
// affirming note, so the header line is always warm rather than empty.

import { localDateStr } from './date.js'

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

function daysAgo(dateStr, today) {
  const a = new Date(today + 'T12:00:00')
  const b = new Date(dateStr + 'T12:00:00')
  return Math.round((a - b) / 86400000)
}

// Consecutive logged days ending on (and counting back from) `endStr`.
function runEndingOn(dateSet, endStr) {
  let count = 0
  let cursor = endStr
  while (dateSet.has(cursor)) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

function fmtMin(mins) {
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// The language studied before but left un-watered the longest, or null.
function mostNeglectedLanguage(entries, languages, today) {
  const lastByLang = {}
  for (const e of entries) {
    if (!lastByLang[e.languageId] || e.date > lastByLang[e.languageId]) {
      lastByLang[e.languageId] = e.date
    }
  }
  let worst = null
  for (const lang of languages) {
    const last = lastByLang[lang.id]
    if (!last) continue // never studied — not "neglected", just not started
    const days = daysAgo(last, today)
    if (days <= 0) continue
    if (!worst || days > worst.days) worst = { name: lang.name, days }
  }
  return worst
}

export function computeNextAction({
  entries = [],
  languages = [],
  todayMinutes = 0,
  weekMinutes = 0,
  goalHours = null,
  activityRows = [],
  today = localDateStr(new Date()),
} = {}) {
  // 0. Brand-new gardener.
  if (entries.length === 0) {
    return {
      kind: 'first-seed',
      tone: 'gentle',
      icon: 'sprout',
      message: 'Plant your first seed — log a session to start your garden.',
    }
  }

  const dateSet = new Set(entries.map((e) => e.date))
  const loggedToday = todayMinutes > 0
  const streakYesterday = runEndingOn(dateSet, addDays(today, -1))

  // 1. A live streak that today would break.
  if (!loggedToday && streakYesterday >= 2) {
    return {
      kind: 'streak-risk',
      tone: 'urgent',
      icon: 'flame',
      message: `Your ${streakYesterday}-day streak is unwatered — log today to keep it alive.`,
    }
  }

  // 2. Within reach of the weekly goal.
  if (goalHours && goalHours > 0) {
    const goalMin = goalHours * 60
    const remaining = goalMin - weekMinutes
    if (remaining > 0 && (remaining <= 30 || weekMinutes / goalMin >= 0.85)) {
      return {
        kind: 'goal-cusp',
        tone: 'opportunity',
        icon: 'target',
        message: `You're ${fmtMin(remaining)} from this week's goal — one session seals it.`,
      }
    }
  }

  // 3. Nothing yet today (no streak at stake).
  if (!loggedToday) {
    return {
      kind: 'plant-today',
      tone: 'gentle',
      icon: 'sprout',
      message: "Plant today's seed — a few minutes keeps your garden growing.",
    }
  }

  // 4. An activity goal falling behind (rows arrive most-behind-first).
  const lagging = activityRows.find(
    (r) => r.targetHours && r.targetHours * 60 - r.loggedMinutes > 0
  )
  if (lagging) {
    return {
      kind: 'activity-goal',
      tone: 'nudge',
      icon: 'target',
      message: `Your ${cap(lagging.type)} goal is behind — ${fmtMin(
        lagging.targetHours * 60 - lagging.loggedMinutes
      )} to go this week.`,
    }
  }

  // 5. A language gone quiet for a week or more.
  const neglected = mostNeglectedLanguage(entries, languages, today)
  if (neglected && neglected.days >= 7) {
    return {
      kind: 'neglected',
      tone: 'gentle',
      icon: 'droplets',
      message: `${neglected.name} hasn't been watered in ${neglected.days} days.`,
    }
  }

  // 6. Everything's tended.
  return {
    kind: 'thriving',
    tone: 'calm',
    icon: 'sprout',
    message: "Your garden's thriving today — keep it growing.",
  }
}
