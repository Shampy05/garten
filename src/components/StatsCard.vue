<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">Garden Stats</h3>
      <div class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
        {{ activeFilterLabel }}
      </div>
    </div>
    
    <div class="grid grid-cols-3 gap-4">
      <div class="text-center">
        <div class="text-3xl font-bold text-green-600">{{ currentStreakVal }}</div>
        <div class="text-xs text-gray-500 mt-1">Current Streak</div>
        <div class="text-xs text-gray-400">days</div>
      </div>
      
      <div class="text-center">
        <div class="text-3xl font-bold text-blue-600">{{ totalHoursThisWeek }}</div>
        <div class="text-xs text-gray-500 mt-1">This Week</div>
        <div class="text-xs text-gray-400">hours</div>
      </div>
      
      <div class="text-center">
        <div class="text-3xl font-bold text-purple-600">{{ totalSessions }}</div>
        <div class="text-xs text-gray-500 mt-1">Total Sessions</div>
        <div class="text-xs text-gray-400">all time</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { localDateStr, currentStreak } from '../lib/date.js'

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
  }
})

const activeFilterLabel = computed(() => {
  if (!props.filter.language) return 'All Languages'
  const lang = props.languages.find(l => l.id === props.filter.language)
  const name = lang ? lang.name : props.filter.language
  if (props.filter.types.length === 0) return name
  return `${name} (${props.filter.types.join(', ')})`
})

const currentStreakVal = computed(() => currentStreak(props.entries.map(e => e.date)))

const totalHoursThisWeek = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const from = localDateStr(monday)
  const to = localDateStr(sunday)

  const totalMinutes = props.entries
    .filter(e => e.date >= from && e.date <= to)
    .reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)

  return (totalMinutes / 60).toFixed(1)
})

const totalSessions = computed(() => {
  return props.entries.length
})
</script>
