<template>
  <div class="gp-card gp-pad">
    <div class="flex items-baseline justify-between mb-4">
      <h3 class="gp-title text-lg">Activity Breakdown</h3>
      <span v-if="rows.length > 0" class="text-xs text-stone-400 tabular-nums">{{ grandTotalFormatted }} total</span>
    </div>
    <div v-if="rows.length === 0" class="text-sm text-stone-400 italic flex items-center gap-2">
      <Sprout :size="18" class="text-stone-300 flex-shrink-0" />
      No sessions logged yet.
    </div>
    <div v-else class="space-y-3.5">
      <div v-for="row in visibleRows" :key="row.id" class="space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: row.color }"></span>
          <span class="text-sm font-medium text-stone-700">{{ row.name }}</span>
          <span class="ml-auto text-xs tabular-nums">
            <span class="font-semibold text-stone-600">{{ row.totalFormatted }}</span>
            <span class="text-stone-400"> · {{ row.pct }}%</span>
          </span>
        </div>
        <div class="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-stone-100 ring-1 ring-inset ring-black/5">
          <div
            v-for="seg in row.segments"
            :key="seg.type"
            class="first:rounded-l-full last:rounded-r-full"
            :style="{ width: seg.percent + '%', backgroundColor: row.color, opacity: seg.opacity }"
            :title="`${seg.type}: ${seg.hoursFormatted}`"
          ></div>
        </div>
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
          <span v-for="seg in row.topSegments" :key="seg.type" class="inline-flex items-center gap-1">
            <span class="capitalize text-stone-500">{{ seg.type }}</span>
            <span class="text-stone-400 tabular-nums">{{ seg.hoursFormatted }}</span>
          </span>
          <span v-if="row.extraTypes > 0" class="text-stone-400">+{{ row.extraTypes }} more</span>
        </div>
      </div>
      <p v-if="hiddenCount > 0" class="text-xs text-stone-400 pt-0.5">
        +{{ hiddenCount }} more {{ hiddenCount === 1 ? 'language' : 'languages' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Sprout } from 'lucide-vue-next'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const MAX_ROWS = 5
const MAX_LEGEND_TYPES = 3

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true }
})

const { nameFor, colorFor } = useLanguageLookup(() => props.languages)

// Stepped opacity so each activity type within a language reads as a distinct
// band of the same hue.
const TYPE_OPACITIES = {
  0: 1,
  1: 0.75,
  2: 0.55,
  3: 0.4,
  4: 0.3,
  5: 0.22,
  6: 0.16,
  7: 0.12
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

const rows = computed(() => {
  const byLang = {}
  for (const e of props.entries) {
    if (!byLang[e.languageId]) byLang[e.languageId] = {}
    if (!byLang[e.languageId][e.type]) byLang[e.languageId][e.type] = 0
    byLang[e.languageId][e.type] += e.hours * 60 + e.minutes
  }

  const grand = Object.values(byLang)
    .reduce((s, types) => s + Object.values(types).reduce((a, v) => a + v, 0), 0)

  return Object.entries(byLang)
    .map(([langId, types]) => {
      const totalMinutes = Object.values(types).reduce((s, v) => s + v, 0)
      const segments = Object.entries(types)
        .sort((a, b) => b[1] - a[1])
        .map(([type, mins], i) => ({
          type,
          minutes: mins,
          hoursFormatted: formatMinutes(mins),
          percent: (mins / totalMinutes) * 100,
          opacity: TYPE_OPACITIES[i] || 0.12
        }))

      return {
        id: langId,
        name: nameFor(langId),
        color: colorFor(langId),
        totalMinutes,
        totalFormatted: formatMinutes(totalMinutes),
        pct: grand > 0 ? Math.round((totalMinutes / grand) * 100) : 0,
        segments,
        topSegments: segments.slice(0, MAX_LEGEND_TYPES),
        extraTypes: Math.max(0, segments.length - MAX_LEGEND_TYPES)
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
})

const grandTotalFormatted = computed(() =>
  formatMinutes(rows.value.reduce((s, r) => s + r.totalMinutes, 0))
)

const visibleRows = computed(() => rows.value.slice(0, MAX_ROWS))
const hiddenCount = computed(() => Math.max(0, rows.value.length - MAX_ROWS))
</script>
