<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
    <h4 class="text-xs font-semibold text-gray-800 mb-3">Top Languages</h4>
    <div v-if="rankings.length === 0" class="text-xs text-gray-400 text-center py-4">
      No data yet
    </div>
    <div v-for="(item, i) in rankings" :key="item.id"
      class="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0"
    >
      <span class="text-xs font-medium text-gray-400 w-5 text-right flex-shrink-0">
        {{ i + 1 }}
      </span>
      <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }"></span>
      <span class="text-xs font-medium text-gray-700 truncate flex-1 min-w-0">{{ item.name }}</span>
      <span v-if="item.streak > 0"
        class="text-xs font-medium text-orange-500 flex-shrink-0"
        :title="item.streak + ' day streak'"
      >
        {{ item.streak }}d
      </span>
      <span class="text-xs font-semibold text-gray-600 w-10 text-right flex-shrink-0">{{ item.hours }}h</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { localDateStr, currentStreak, getMonthRange, getQuarterRange, getYearRange } from '../lib/date.js'
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

const rankings = computed(() => {
  const minutesByLang = {}
  for (const e of periodEntries.value) {
    minutesByLang[e.languageId] = (minutesByLang[e.languageId] || 0) + (e.hours * 60 + e.minutes)
  }

  const sorted = Object.entries(minutesByLang)
    .map(([langId, mins]) => {
      const langEntries = periodEntries.value.filter(e => e.languageId === langId)
      const langDates = new Set(langEntries.map(e => e.date))
      return {
        id: langId,
        name: nameFor(langId),
        color: colorFor(langId),
        hours: +(mins / 60).toFixed(1),
        minutes: mins,
        streak: currentStreak(langDates)
      }
    })
    .sort((a, b) => b.minutes - a.minutes)

  return sorted
})
</script>
