<template>
  <div class="gp-card gp-pad">
    <h3 class="gp-title text-lg mb-4">Insights</h3>
    <div v-if="periodEntries.length === 0" class="text-sm text-stone-400 italic flex items-center gap-2">
      <Sprout :size="18" class="text-stone-300 flex-shrink-0" />
      Not enough data to generate insights yet. Start logging your sessions!
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Total logged</div>
        <div class="font-display text-lg font-bold text-stone-800 tabular-nums">{{ totalHours }}h</div>
        <div class="text-[10px] text-stone-400">this {{ periodLabel }}</div>
      </div>
      <div class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Languages</div>
        <div class="font-display text-lg font-bold text-stone-800 tabular-nums">{{ languageCount }}</div>
        <div class="text-[10px] text-stone-400">active</div>
      </div>
      <div class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Daily avg</div>
        <div class="font-display text-lg font-bold text-stone-800 tabular-nums">{{ dailyAvg }}</div>
        <div class="text-[10px] text-stone-400">min / day</div>
      </div>
      <div v-if="bestStreak.days >= 3" class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Best streak</div>
        <div class="font-display text-lg font-bold text-stone-800 tabular-nums">{{ bestStreak.days }}d</div>
        <div class="text-[10px] text-stone-400">{{ bestStreak.language }}</div>
      </div>
      <div v-if="busiestDay" class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Busiest day</div>
        <div class="font-display text-lg font-bold text-stone-800">{{ busiestDay }}</div>
        <div class="text-[10px] text-stone-400">{{ busiestDayHours }}h logged</div>
      </div>
      <div v-if="topLanguage && languageCount > 1" class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Top language</div>
        <div class="font-display text-lg font-bold" :style="{ color: topLanguage.color }">{{ topLanguage.name }}</div>
        <div class="text-[10px] text-stone-400">{{ topLanguage.hours }}h</div>
      </div>
      <div v-if="languageCount === 1" class="bg-stone-50 rounded-xl p-3 border border-line">
        <div class="text-xs text-stone-500 mb-1">Sessions</div>
        <div class="font-display text-lg font-bold text-stone-800 tabular-nums">{{ sessionCount }}</div>
        <div class="text-[10px] text-stone-400">logged this {{ periodLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Sprout } from 'lucide-vue-next'
import { localDateStr, getMonthRange, getQuarterRange, getYearRange } from '../lib/date.js'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true },
  viewMode: { type: String, default: 'month' },
  viewDate: { type: Date, default: () => new Date() }
})

const { nameFor, colorFor } = useLanguageLookup(() => props.languages)

const dateRange = computed(() => {
  const d = props.viewDate
  let range
  switch (props.viewMode) {
    case 'month': range = getMonthRange(d); break
    case 'quarter': range = getQuarterRange(d); break
    case 'year': range = getYearRange(d); break
    default: range = getMonthRange(d)
  }
  return { start: localDateStr(range.start), end: localDateStr(range.end) }
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

const sessionCount = computed(() => periodEntries.value.length)

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
  return { name: nameFor(langId), hours: (mins / 60).toFixed(1), color: colorFor(langId) }
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
      best = { days: maxStreak, language: nameFor(langId) }
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
