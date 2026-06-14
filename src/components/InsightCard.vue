<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mt-6">
    <h3 class="text-lg font-semibold text-gray-800 mb-4">Insights</h3>
    <div v-if="periodEntries.length === 0" class="text-sm text-gray-400 italic">
      Not enough data to generate insights yet. Start logging your sessions!
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Total logged</div>
        <div class="text-lg font-bold text-gray-800">{{ totalHours }}h</div>
        <div class="text-[10px] text-gray-400">this {{ periodLabel }}</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Languages</div>
        <div class="text-lg font-bold text-gray-800">{{ languageCount }}</div>
        <div class="text-[10px] text-gray-400">active</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Daily avg</div>
        <div class="text-lg font-bold text-gray-800">{{ dailyAvg }}</div>
        <div class="text-[10px] text-gray-400">min / day</div>
      </div>
      <div v-if="bestStreak.days >= 3" class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Best streak</div>
        <div class="text-lg font-bold text-gray-800">{{ bestStreak.days }}d</div>
        <div class="text-[10px] text-gray-400">{{ bestStreak.language }}</div>
      </div>
      <div v-if="busiestDay" class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Busiest day</div>
        <div class="text-lg font-bold text-gray-800">{{ busiestDay }}</div>
        <div class="text-[10px] text-gray-400">{{ busiestDayHours }}h logged</div>
      </div>
      <div v-if="topLanguage" class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Top language</div>
        <div class="text-lg font-bold" :style="{ color: topLanguage.color }">{{ topLanguage.name }}</div>
        <div class="text-[10px] text-gray-400">{{ topLanguage.hours }}h</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true },
  viewMode: { type: String, default: 'month' },
  viewDate: { type: Date, default: () => new Date() }
})

function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const dateRange = computed(() => {
  const d = props.viewDate
  switch (props.viewMode) {
    case 'month': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { start: localDateStr(start), end: localDateStr(end) }
    }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3)
      const start = new Date(d.getFullYear(), q * 3, 1)
      const end = new Date(d.getFullYear(), q * 3 + 3, 0)
      return { start: localDateStr(start), end: localDateStr(end) }
    }
    case 'year': {
      const start = new Date(d.getFullYear(), 0, 1)
      const end = new Date(d.getFullYear(), 11, 31)
      return { start: localDateStr(start), end: localDateStr(end) }
    }
    default: {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { start: localDateStr(start), end: localDateStr(end) }
    }
  }
})

const periodEntries = computed(() => {
  const range = dateRange.value
  return props.entries.filter(e => e.date >= range.start && e.date <= range.end)
})

const periodLabel = computed(() => {
  const labels = { month: 'month', quarter: 'quarter', year: 'year' }
  return labels[props.viewMode] || 'period'
})

const totalMinutes = computed(() =>
  periodEntries.value.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)
)

const totalHours = computed(() => (totalMinutes.value / 60).toFixed(1))

const languageCount = computed(() => {
  const ids = new Set(periodEntries.value.map(e => e.languageId))
  return ids.size
})

const dailyAvg = computed(() => {
  const uniqueDays = new Set(periodEntries.value.map(e => e.date)).size
  return uniqueDays > 0 ? Math.round(totalMinutes.value / uniqueDays) : 0
})

const topLanguage = computed(() => {
  const byLang = {}
  for (const e of periodEntries.value) {
    byLang[e.languageId] = (byLang[e.languageId] || 0) + e.hours * 60 + e.minutes
  }
  const sorted = Object.entries(byLang).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return null
  const [langId, mins] = sorted[0]
  const lang = props.languages.find(l => l.id === langId)
  return { name: lang ? lang.name : langId, hours: (mins / 60).toFixed(1), color: lang ? lang.color : '#16a34a' }
})

const bestStreak = computed(() => {
  const langDates = {}
  for (const e of props.entries) {
    if (!langDates[e.languageId]) langDates[e.languageId] = new Set()
    langDates[e.languageId].add(e.date)
  }
  let best = { days: 0, language: '' }
  for (const [langId, dateSet] of Object.entries(langDates)) {
    const sorted = [...dateSet].sort()
    let streak = 1
    let maxStreak = 1
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T12:00:00')
      const curr = new Date(sorted[i] + 'T12:00:00')
      const diff = (curr - prev) / (1000 * 60 * 60 * 24)
      if (diff === 1) {
        streak++
        maxStreak = Math.max(maxStreak, streak)
      } else {
        streak = 1
      }
    }
    if (maxStreak > best.days) {
      const lang = props.languages.find(l => l.id === langId)
      best = { days: maxStreak, language: lang ? lang.name : langId }
    }
  }
  return best
})

const busiestDay = computed(() => {
  const dayMins = [0, 0, 0, 0, 0, 0, 0]
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (const e of periodEntries.value) {
    const d = new Date(e.date + 'T12:00:00')
    dayMins[d.getDay()] += e.hours * 60 + e.minutes
  }
  const maxIdx = dayMins.indexOf(Math.max(...dayMins))
  if (dayMins[maxIdx] === 0) return null
  return dayNames[maxIdx]
})

const busiestDayHours = computed(() => {
  const dayMins = [0, 0, 0, 0, 0, 0, 0]
  for (const e of periodEntries.value) {
    const d = new Date(e.date + 'T12:00:00')
    dayMins[d.getDay()] += e.hours * 60 + e.minutes
  }
  return (Math.max(...dayMins) / 60).toFixed(1)
})
</script>
