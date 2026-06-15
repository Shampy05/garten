<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-display text-lg font-semibold text-gray-800">Garden Stats</h3>
      <div class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
        {{ activeFilterLabel }}
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="text-center">
        <div class="font-display text-3xl font-bold text-green-600">{{ activeDays }}</div>
        <div class="text-xs text-gray-500 mt-1">Active Days</div>
        <div class="text-xs text-gray-400">{{ periodLabel }}</div>
      </div>

      <div class="text-center">
        <div class="font-display text-3xl font-bold text-blue-600">{{ periodHours }}</div>
        <div class="text-xs text-gray-500 mt-1">Hours</div>
        <div class="text-xs text-gray-400">{{ periodLabel }}</div>
      </div>

      <div class="text-center">
        <div class="font-display text-3xl font-bold text-purple-600">{{ periodSessions }}</div>
        <div class="text-xs text-gray-500 mt-1">Sessions</div>
        <div class="text-xs text-gray-400">{{ periodLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { localDateStr, getMonthRange, getQuarterRange, getYearRange } from '../lib/date.js'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const props = defineProps({
  entries: {
    type: Array,
    required: true
  },
  languages: {
    type: Array,
    default: () => []
  },
  filter: {
    type: Object,
    default: () => ({ language: null, types: [] })
  },
  viewMode: {
    type: String,
    default: 'month'
  },
  viewDate: {
    type: Date,
    default: () => new Date()
  }
})

const { nameFor } = useLanguageLookup(() => props.languages)

const activeFilterLabel = computed(() => {
  if (!props.filter.language) return 'All Languages'
  const name = nameFor(props.filter.language)
  if (props.filter.types.length === 0) return name
  return `${name} (${props.filter.types.join(', ')})`
})

const periodLabel = computed(() => {
  const labels = { month: 'this month', quarter: 'this quarter', year: 'this year' }
  return labels[props.viewMode] || 'this period'
})

// Same timeframe window the heatmap, leaderboard and insights use.
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

// props.entries already has the language/type filter applied upstream.
const periodEntries = computed(() => {
  const { start, end } = dateRange.value
  return props.entries.filter(e => e.date >= start && e.date <= end)
})

const activeDays = computed(() => new Set(periodEntries.value.map(e => e.date)).size)

const periodHours = computed(() =>
  (periodEntries.value.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0) / 60).toFixed(1)
)

const periodSessions = computed(() => periodEntries.value.length)
</script>
