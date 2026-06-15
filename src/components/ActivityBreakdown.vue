<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mt-6">
    <h3 class="text-lg font-semibold text-gray-800 mb-4">Activity Breakdown</h3>
    <div v-if="rows.length === 0" class="text-sm text-gray-400 italic">
      No sessions logged yet.
    </div>
    <div v-else class="space-y-4">
      <div v-for="row in rows" :key="row.id" class="space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: row.color }"></span>
          <span class="text-sm font-medium text-gray-700">{{ row.name }}</span>
          <span class="text-xs text-gray-400 ml-auto">{{ row.totalFormatted }}</span>
        </div>
        <div class="flex gap-0.5 h-5 rounded-full overflow-hidden bg-gray-100">
          <div
            v-for="seg in row.segments"
            :key="seg.type"
            class="relative group flex items-center justify-center overflow-hidden first:rounded-l-full last:rounded-r-full"
            :style="{ width: seg.percent + '%', backgroundColor: row.color, opacity: seg.opacity }"
          >
            <span v-if="seg.percent > 6" class="text-[9px] font-bold text-white/90 select-none leading-none">
              {{ seg.initial }}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-0.5">
          <span v-for="seg in row.segments" :key="seg.type" class="flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: row.color, opacity: seg.opacity }"></span>
            <span class="text-[10px] text-gray-500 capitalize">{{ seg.type }}</span>
            <span class="text-[10px] text-gray-400">{{ seg.initial }} {{ seg.hoursFormatted }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true }
})

const { nameFor, colorFor } = useLanguageLookup(() => props.languages)

const TYPE_INITIALS = {
  reading: 'R',
  grammar: 'G',
  vocabulary: 'V',
  listening: 'L',
  speaking: 'S',
  writing: 'W',
  pronunciation: 'P'
}

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

  return Object.entries(byLang)
    .map(([langId, types]) => {
      const langName = nameFor(langId)
      const langColor = colorFor(langId)
      const totalMinutes = Object.values(types).reduce((s, v) => s + v, 0)
      const segments = Object.entries(types)
        .sort((a, b) => b[1] - a[1])
        .map(([type, mins], i) => ({
          type,
          initial: TYPE_INITIALS[type] || type[0].toUpperCase(),
          minutes: mins,
          hoursFormatted: formatMinutes(mins),
          percent: (mins / totalMinutes) * 100,
          opacity: TYPE_OPACITIES[i] || 0.12
        }))

      return {
        id: langId,
        name: langName,
        color: langColor,
        totalMinutes,
        totalFormatted: formatMinutes(totalMinutes),
        segments
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
})
</script>
