<template>
  <div class="rounded-2xl border border-line bg-stone-50/70 p-4">
    <h4 class="font-display text-xs font-semibold text-stone-700 uppercase tracking-wider mb-3">Top Languages</h4>
    <div v-if="rankings.length === 0" class="text-xs text-stone-400 text-center py-4">
      <Sprout :size="24" class="mx-auto mb-2 text-stone-300" />
      <p>No data yet</p>
    </div>
    <div v-for="(item, i) in rankings" :key="item.id"
      class="flex items-center gap-2 py-2 border-b border-stone-200/60 last:border-0"
    >
      <span class="font-display text-xs font-semibold text-stone-400 w-5 text-right flex-shrink-0 tabular-nums">
        {{ i + 1 }}
      </span>
      <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white" :style="{ backgroundColor: item.color }"></span>
      <span class="text-xs font-medium text-stone-700 truncate flex-1 min-w-0">{{ item.name }}</span>
      <span v-if="item.streak > 0"
        class="text-xs font-semibold text-orange-500 flex-shrink-0 tabular-nums"
        :title="item.streak + ' day streak'"
      >
        {{ item.streak }}d
      </span>
      <span class="text-xs font-semibold text-stone-600 w-10 text-right flex-shrink-0 tabular-nums">{{ item.hours }}h</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Sprout } from 'lucide-vue-next'
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
