// Pure view-model helpers for the "Recent sessions" story (slice 4): merging
// study sessions with reading-progress rows, per-day language mix, and
// week-digest summaries. Kept out of App.vue so the grouping/merge logic is
// unit-testable independent of Vue reactivity.

import { localDateStr, getWeekRange } from './date.js'

const MINUTES = (e) => e.hours * 60 + e.minutes

// Combine study-session entries with normalized reading-progress rows into one
// timeline, newest first. Both row shapes carry `date` + `createdAt`; the
// caller tags each with `kind` before calling this ('session' | 'reading').
export function mergeTimelineRows(sessionRows = [], readingRows = []) {
  return [...sessionRows, ...readingRows].sort((a, b) => {
    const dateDiff = new Date(b.date) - new Date(a.date)
    if (dateDiff !== 0) return dateDiff
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  })
}

// Bucket an already-sorted (desc) row list into per-day groups, preserving order.
export function groupRowsByDay(rows = []) {
  const groups = []
  const byDate = new Map()
  for (const row of rows) {
    let group = byDate.get(row.date)
    if (!group) {
      group = { date: row.date, rows: [] }
      byDate.set(row.date, group)
      groups.push(group)
    }
    group.rows.push(row)
  }
  return groups
}

// Proportional language-mix segments for one day's study entries — the same
// visual grammar as the weekly-goal bar, but unscaled (always sums to ~100%).
// Reading-progress rows are excluded: pages aren't time, so mixing them into a
// minutes-based bar would misrepresent the split.
export function dayLanguageMix(dayEntries = [], languages = []) {
  const byLang = {}
  let total = 0
  for (const e of dayEntries) {
    const mins = MINUTES(e)
    byLang[e.languageId] = (byLang[e.languageId] || 0) + mins
    total += mins
  }
  if (total <= 0) return []
  return Object.entries(byLang)
    .sort((a, b) => b[1] - a[1])
    .map(([langId, mins]) => {
      const lang = languages.find((l) => l.id === langId)
      return {
        name: lang ? lang.name : 'Other',
        color: lang ? lang.color : '#a8a29e',
        percent: (mins / total) * 100,
      }
    })
}

// The Monday (YYYY-MM-DD) of the ISO week containing dateStr.
export function weekStartFor(dateStr) {
  const { start } = getWeekRange(new Date(dateStr + 'T12:00:00'))
  return localDateStr(start)
}

// A short "Week of Jun 22" label for a Monday date string.
export function weekLabel(weekStartStr) {
  const d = new Date(weekStartStr + 'T12:00:00')
  return `Week of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

// Digest stats for the ISO week containing `dateStr`, computed from the FULL
// (unfiltered, unpaginated) entries array — so a digest is accurate even when
// only some of that week's sessions are visible in a paginated timeline slice.
export function weekSummary(entries = [], languages = [], dateStr) {
  const { start, end } = getWeekRange(new Date(dateStr + 'T12:00:00'))
  const startStr = localDateStr(start)
  const endStr = localDateStr(end)
  const weekEntries = entries.filter((e) => e.date >= startStr && e.date <= endStr)

  const totalMinutes = weekEntries.reduce((sum, e) => sum + MINUTES(e), 0)
  const activeDays = new Set(weekEntries.map((e) => e.date)).size

  const byLang = {}
  for (const e of weekEntries) byLang[e.languageId] = (byLang[e.languageId] || 0) + MINUTES(e)
  const topEntry = Object.entries(byLang).sort((a, b) => b[1] - a[1])[0]
  const topLanguageName = topEntry ? (languages.find((l) => l.id === topEntry[0])?.name ?? null) : null

  return {
    weekStart: startStr,
    label: weekLabel(startStr),
    totalMinutes,
    activeDays,
    topLanguageName,
  }
}
