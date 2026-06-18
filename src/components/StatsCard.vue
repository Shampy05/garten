<template>
  <div class="flex items-center gap-4 flex-shrink-0">
    <div class="text-center sm:text-right">
      <div class="font-display text-xl font-bold text-stone-800 leading-none tabular-nums">{{ activeDays }}</div>
      <div class="text-[10px] text-stone-400 uppercase tracking-wide mt-0.5">days</div>
    </div>
    <div class="w-px h-7 bg-line"></div>
    <div class="text-center sm:text-right">
      <div class="font-display text-xl font-bold text-stone-800 leading-none tabular-nums">{{ periodHours }}h</div>
      <div class="text-[10px] text-stone-400 uppercase tracking-wide mt-0.5">logged</div>
    </div>
    <div class="w-px h-7 bg-line"></div>
    <div class="text-center sm:text-right">
      <div class="font-display text-xl font-bold text-stone-800 leading-none tabular-nums">{{ periodSessions }}</div>
      <div class="text-[10px] text-stone-400 uppercase tracking-wide mt-0.5">sessions</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { localDateStr, getMonthRange, getQuarterRange, getYearRange } from '../lib/date.js'

const props = defineProps({
  entries: { type: Array, required: true },
  filter: { type: Object, default: () => ({ language: null, types: [] }) },
  viewMode: { type: String, default: 'month' },
  viewDate: { type: Date, default: () => new Date() }
})

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
  const { start, end } = dateRange.value
  return props.entries.filter(e => e.date >= start && e.date <= end)
})

const activeDays = computed(() => new Set(periodEntries.value.map(e => e.date)).size)

const periodHours = computed(() =>
  (periodEntries.value.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0) / 60).toFixed(1)
)

const periodSessions = computed(() => periodEntries.value.length)
</script>
