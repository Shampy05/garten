import { computed } from 'vue'
import { localDateStr, getMonthRange, getQuarterRange, getYearRange } from '../lib/date.js'

export function useDateRange(viewMode, viewDate) {
  const dateRange = computed(() => {
    const d = viewDate.value
    switch (viewMode.value) {
      case 'month': return getMonthRange(d)
      case 'quarter': return getQuarterRange(d)
      case 'year': return getYearRange(d)
      default: return getMonthRange(d)
    }
  })

  function filterByRange(entries) {
    const start = localDateStr(dateRange.value.start)
    const end = localDateStr(dateRange.value.end)
    return entries.filter(e => e.date >= start && e.date <= end)
  }

  return { dateRange, filterByRange }
}
