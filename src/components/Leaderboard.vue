<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
    <h4 class="text-sm font-semibold text-gray-800 mb-3">Language Activity</h4>
    <div v-if="rankings.length === 0" class="text-xs text-gray-400 text-center py-4">
      No data yet
    </div>
    <div v-for="(item, i) in rankings" :key="item.id"
      class="pb-2 mb-2 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0"
    >
      <div class="flex items-center gap-1.5 mb-1">
        <span class="text-xs w-5 text-right flex-shrink-0">
          {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1 }}
        </span>
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }"></span>
        <span class="text-xs font-medium text-gray-700 truncate flex-1 min-w-0">{{ item.name }}</span>
        <span v-if="item.streak > 0"
          class="text-xs flex items-center gap-0.5 text-orange-500 font-medium flex-shrink-0"
          :title="item.streak + ' day streak'"
        >
          <span>🔥</span>
          <span>{{ item.streak }}</span>
        </span>
        <span class="text-xs font-semibold text-gray-600 w-10 text-right flex-shrink-0">{{ item.hours }}h</span>
      </div>

      <div class="flex items-center gap-0.5 ml-7 mb-1">
        <div v-for="(dot, idx) in item.last7" :key="idx"
          class="w-2 h-2 rounded-[1.5px]"
          :class="dot.active ? '' : 'bg-gray-200'"
          :style="dot.active ? { backgroundColor: item.color } : {}"
          :title="dot.date"
        ></div>
        <span class="text-[10px] text-gray-400 ml-1.5">· {{ item.daysActive }} days this {{ periodLabel }}</span>
      </div>

      <div class="h-1 bg-gray-100 rounded-full overflow-hidden ml-7">
        <div class="h-full rounded-full transition-all" :style="{ width: item.percent + '%', backgroundColor: item.color }"></div>
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

const periodLabel = computed(() => {
  const labels = { month: 'month', quarter: 'quarter', year: 'year' }
  return labels[props.viewMode] || 'month'
})

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

const last7Days = computed(() => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(localDateStr(d))
  }
  return days
})

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

const currentStreak = (dates) => {
  const sorted = [...dates].sort().reverse()
  if (sorted.length === 0) return 0
  const today = localDateStr(new Date())
  const yesterday = localDateStr(new Date(Date.now() - 86400000))
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  for (let i = 0; i < sorted.length - 1; i++) {
    if (daysBetween(sorted[i + 1], sorted[i]) === 1) streak++
    else break
  }
  return streak
}

const rankings = computed(() => {
  const minutesByLang = {}
  for (const e of periodEntries.value) {
    minutesByLang[e.languageId] = (minutesByLang[e.languageId] || 0) + (e.hours * 60 + e.minutes)
  }

  const sorted = Object.entries(minutesByLang)
    .map(([langId, mins]) => {
      const lang = props.languages.find(l => l.id === langId)
      const langEntries = periodEntries.value.filter(e => e.languageId === langId)
      const langDates = new Set(langEntries.map(e => e.date))
      return {
        id: langId,
        name: lang ? lang.name : langId,
        color: lang ? lang.color : '#16a34a',
        hours: +(mins / 60).toFixed(1),
        minutes: mins,
        last7: last7Days.value.map(d => ({ date: d, active: langDates.has(d) })),
        streak: currentStreak(langDates),
        daysActive: langDates.size
      }
    })
    .sort((a, b) => b.minutes - a.minutes)

  const maxMinutes = sorted.length > 0 ? sorted[0].minutes : 0
  return sorted.map(item => ({
    ...item,
    percent: maxMinutes > 0 ? (item.minutes / maxMinutes) * 100 : 0
  }))
})
</script>
