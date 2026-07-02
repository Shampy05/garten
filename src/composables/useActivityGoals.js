import { computed } from 'vue'
import { localDateStr, getWeekRange } from '../lib/date.js'

// Per-activity-type weekly goals (reading, writing, listening, ...), mirroring
// useWeeklyGoal but scoped to one activity type across all languages instead
// of one overall total.
export function useActivityGoals(entries, languages, activityGoals, saveActivityGoals) {
  const weekRange = computed(() => {
    const { start, end } = getWeekRange(new Date())
    return { start: localDateStr(start), end: localDateStr(end) }
  })

  // Only offer goals for types the user actually has assigned to a language —
  // no point showing a "pronunciation" goal to someone who never added it.
  const trackedTypes = computed(() => {
    const set = new Set()
    for (const lang of languages.value) {
      for (const t of lang.types || []) set.add(t)
    }
    return Array.from(set)
  })

  const weekMinutesByType = computed(() => {
    const map = {}
    for (const e of entries.value) {
      if (e.date < weekRange.value.start || e.date > weekRange.value.end) continue
      map[e.type] = (map[e.type] || 0) + e.hours * 60 + e.minutes
    }
    return map
  })

  const rows = computed(() => {
    return trackedTypes.value
      .map((type) => {
        const targetHours = activityGoals.value[type] ?? null
        const loggedMinutes = weekMinutesByType.value[type] || 0
        const progress = targetHours ? Math.min((loggedMinutes / (targetHours * 60)) * 100, 100) : 0
        return { type, targetHours, loggedMinutes, progress }
      })
      .sort((a, b) => {
        // Goals you're tracking surface first; among those, the ones needing
        // the most attention lead. Untracked types trail, sorted by recent use.
        if (!!a.targetHours !== !!b.targetHours) return a.targetHours ? -1 : 1
        if (a.targetHours) return a.progress - b.progress
        return b.loggedMinutes - a.loggedMinutes
      })
  })

  async function setGoal(type, hours) {
    const val = parseFloat(hours)
    const next = { ...activityGoals.value }
    if (!val || val <= 0) {
      delete next[type]
    } else {
      next[type] = val
    }
    await saveActivityGoals(next)
  }

  async function clearGoal(type) {
    await setGoal(type, null)
  }

  return {
    rows,
    setGoal,
    clearGoal
  }
}
