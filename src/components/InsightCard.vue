<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
    <h3 class="text-lg font-semibold text-gray-800 mb-4">Insights</h3>
    <div class="text-sm text-gray-700 leading-relaxed space-y-1">
      <p v-if="topLanguage && periodEntries.length > 0">
        This <span class="text-gray-500">{{ periodLabel }}</span>,
        <span class="font-medium" :style="{ color: topLanguage.color }">{{ topLanguage.name }}</span>
        was your top language ({{ topLanguage.hours }}h).
      </p>
      <p v-if="longestStreak.days >= 2">
        Your longest streak was <span class="font-medium">{{ longestStreak.days }} days</span>
        ({{ longestStreak.language }}).
      </p>
      <p v-for="bias in weekendBiases" :key="bias.name">
        You studied <span class="font-medium" :style="{ color: bias.color }">{{ bias.name }}</span>
        {{ bias.bias }}.
      </p>
      <p v-if="periodEntries.length === 0" class="text-gray-400 italic">
        Not enough data to generate insights yet. Start logging your sessions!
      </p>
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
  switch (props.viewMode) {
    case 'month': return 'month'
    case 'quarter': return 'quarter'
    case 'year': return 'year'
    default: return 'period'
  }
})

const topLanguage = computed(() => {
  const minutesByLang = {}
  for (const e of periodEntries.value) {
    minutesByLang[e.languageId] = (minutesByLang[e.languageId] || 0) + (e.hours * 60 + e.minutes)
  }
  const sorted = Object.entries(minutesByLang).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return null
  const [langId, totalMin] = sorted[0]
  const lang = props.languages.find(l => l.id === langId)
  return { name: lang ? lang.name : langId, hours: (totalMin / 60).toFixed(1), color: lang ? lang.color : '#16a34a' }
})

const longestStreak = computed(() => {
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
      best = { days: maxStreak, language: lang ? lang.name : langId, langId }
    }
  }
  return best
})

const weekendBiases = computed(() => {
  const langCounts = {}
  for (const e of periodEntries.value) {
    if (!langCounts[e.languageId]) langCounts[e.languageId] = { weekend: 0, weekday: 0 }
    const d = new Date(e.date + 'T12:00:00')
    const day = d.getDay()
    const mins = e.hours * 60 + e.minutes
    if (day === 0 || day === 6) {
      langCounts[e.languageId].weekend += mins
    } else {
      langCounts[e.languageId].weekday += mins
    }
  }

  return Object.entries(langCounts)
    .map(([langId, counts]) => {
      const total = counts.weekend + counts.weekday
      if (total === 0) return null
      const weekendPct = (counts.weekend / total) * 100
      const lang = props.languages.find(l => l.id === langId)
      const bias = weekendPct > 60 ? 'mostly on weekends' : (weekendPct < 30 ? 'mostly on weekdays' : '')
      return bias ? { name: lang ? lang.name : langId, color: lang ? lang.color : '#16a34a', bias } : null
    })
    .filter(Boolean)
})
</script>
