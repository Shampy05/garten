import { ref, computed, watch } from 'vue'
import { localDateStr, getWeekRange } from '../lib/date.js'

export function useWeeklyGoal(entries, languages, weeklyGoal, saveGoal) {
  const goalHours = ref(null)
  const goalEditing = ref(false)

  watch(weeklyGoal, (v) => { goalHours.value = v }, { immediate: true })

  const weekRange = computed(() => {
    const { start, end } = getWeekRange(new Date())
    return { start: localDateStr(start), end: localDateStr(end) }
  })

  const weekMinutes = computed(() => {
    return entries.value
      .filter(e => e.date >= weekRange.value.start && e.date <= weekRange.value.end)
      .reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)
  })

  const goalProgress = computed(() => {
    if (!goalHours.value || goalHours.value <= 0) return 0
    return Math.min((weekMinutes.value / (goalHours.value * 60)) * 100, 100)
  })

  const goalSegments = computed(() => {
    if (!goalHours.value || goalHours.value <= 0 || weekMinutes.value === 0) return []

    const weekEntries = entries.value.filter(e => e.date >= weekRange.value.start && e.date <= weekRange.value.end)
    const byLang = {}
    for (const e of weekEntries) {
      byLang[e.languageId] = (byLang[e.languageId] || 0) + e.hours * 60 + e.minutes
    }

    const total = Object.values(byLang).reduce((s, v) => s + v, 0)
    const filledPct = Math.min((total / (goalHours.value * 60)) * 100, 100)

    return Object.entries(byLang)
      .sort((a, b) => b[1] - a[1])
      .map(([langId, mins]) => {
        const lang = languages.value.find(l => l.id === langId)
        return {
          color: lang ? lang.color : '#16a34a',
          percent: (mins / total) * filledPct
        }
      })
  })

  const saveGoalInput = () => {
    const val = parseFloat(goalHours.value)
    if (!val || val <= 0) { saveGoal(null); goalEditing.value = false; return }
    saveGoal(val)
    goalEditing.value = false
  }

  return {
    goalHours,
    goalEditing,
    weekMinutes,
    goalProgress,
    goalSegments,
    saveGoalInput
  }
}
