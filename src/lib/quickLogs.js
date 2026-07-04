// Pure helper: suggest up to N "log this again" chips derived from recent
// entries, so the app's most-travelled path can be a single tap.
//
// Selection (deduped, capped):
//   1. The most recent entry's exact (languageId, type) combo — the strongest
//      "do it again" cue, including today's last session if one exists.
//   2. The most frequent combo in the last 14 days — the user's actual habit,
//      weighted by repetition rather than recency. If the same as #1, it's
//      skipped (no point showing the same chip twice).
//   3. Fill remaining slots with the next-most-frequent combos in the window.
//
// Each chip carries the duration of one session in that combo (most recent
// occurrence — not the sum across repeats). Caller is responsible for
// filtering by currently-tracked languages; this helper stays pure.

const MAX_SUGGESTIONS = 3
const FREQUENT_WINDOW_DAYS = 14

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function compareEntriesDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  const ac = a.createdAt || ''
  const bc = b.createdAt || ''
  if (ac !== bc) return ac < bc ? 1 : -1
  return 0
}

function groupByCombo(entries) {
  const map = new Map()
  for (const e of entries) {
    const k = `${e.languageId}::${e.type}`
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(e)
  }
  return map
}

// Pick a single session's duration for a combo — the most recent one, since
// the chip is "do this again", not "you did 90m total over 3 sessions".
function comboFromGroup(group) {
  const sorted = [...group].sort(compareEntriesDesc)
  const top = sorted[0]
  return {
    languageId: top.languageId,
    type: top.type,
    hours: top.hours,
    minutes: top.minutes,
  }
}

export function suggestQuickLogs(entries = [], { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return []

  const sortedDesc = [...entries].sort(compareEntriesDesc)
  const windowStart = addDays(today, -FREQUENT_WINDOW_DAYS)
  const recentWindow = entries.filter((e) => e.date >= windowStart)
  const groups = groupByCombo(recentWindow)
  const frequentGroups = [...groups.values()].sort((a, b) => b.length - a.length)

  const out = []
  const seen = new Set()
  const push = (group) => {
    if (!group || group.length === 0) return
    const combo = comboFromGroup(group)
    const k = `${combo.languageId}::${combo.type}`
    if (seen.has(k)) return
    seen.add(k)
    out.push(combo)
  }

  // 1. The most recent entry's combo.
  const mostRecent = sortedDesc[0]
  if (mostRecent) {
    const k = `${mostRecent.languageId}::${mostRecent.type}`
    push(groups.get(k) || [mostRecent])
  }

  // 2. The most frequent combo in the window, if distinct from #1.
  push(frequentGroups[0])

  // 3. Fill remaining slots with the next-most-frequent combos.
  for (let i = 1; i < frequentGroups.length && out.length < MAX_SUGGESTIONS; i++) {
    push(frequentGroups[i])
  }

  return out.slice(0, MAX_SUGGESTIONS)
}
