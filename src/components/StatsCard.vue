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
        <div class="text-3xl font-bold text-green-600">{{ currentStreak }}</div>
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

const props = defineProps({
  entries: {
    type: Array,
    required: true
  },
  filter: {
    type: Object,
    default: () => ({ language: null, types: [] })
  }
})

const activeFilterLabel = computed(() => {
  if (!props.filter.language) return 'All Languages'
  if (props.filter.types.length === 0) return props.filter.language
  return `${props.filter.language} (${props.filter.types.join(', ')})`
})

const currentStreak = computed(() => {
  if (props.entries.length === 0) return 0
  
  const sortedDates = [...new Set(props.entries.map(e => e.date))].sort().reverse()
  let streak = 0
  let checkDate = new Date()
  
  for (const dateStr of sortedDates) {
    const entryDate = new Date(dateStr)
    const diffDays = Math.floor((checkDate - entryDate) / (1000 * 60 * 60 * 24))
    
    if (diffDays === streak) {
      streak++
    } else if (diffDays > streak) {
      break
    }
  }
  
  return streak
})

const totalHoursThisWeek = computed(() => {
  const now = new Date()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  
  const weekEntries = props.entries.filter(entry => {
    const entryDate = new Date(entry.date)
    return entryDate >= weekAgo
  })
  
  const totalMinutes = weekEntries.reduce((sum, entry) => {
    return sum + (entry.hours * 60 + entry.minutes)
  }, 0)
  
  return (totalMinutes / 60).toFixed(1)
})

const totalSessions = computed(() => {
  return props.entries.length
})
</script>
