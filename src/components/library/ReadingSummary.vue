<template>
  <div v-if="rows.length" class="gp-card gp-pad">
    <h3 class="gp-title text-base mb-3">Reading by language</h3>
    <div class="space-y-2.5">
      <div v-for="row in rows" :key="row.languageCode" class="flex items-center gap-3">
        <span class="text-sm font-semibold text-stone-700 w-24 flex-shrink-0 truncate">{{ row.languageName }}</span>
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            v-for="seg in segments(row)"
            :key="seg.key"
            class="h-2 rounded-full transition-all duration-500"
            :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
            :title="`${seg.label}: ${seg.count}`"
          ></span>
        </div>
        <span class="text-xs text-stone-500 tabular-nums flex-shrink-0">
          {{ summaryText(row) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { summaryByLanguage } from '../../lib/readingStats.js'

const props = defineProps({
  savedBooks: { type: Array, default: () => [] },
})

const rows = computed(() => summaryByLanguage(props.savedBooks))

// read = full green, reading = orange, want = light stone — matches the badge
// colours on SavedBookCard so the bar reads consistently.
const STATUS_META = [
  { key: 'read', label: 'Read', color: '#287a41' },
  { key: 'reading', label: 'Reading', color: '#ea7317' },
  { key: 'want_to_read', label: 'Want to read', color: '#d6d3d1' },
]

function segments(row) {
  return STATUS_META.filter((m) => row[m.key] > 0).map((m) => ({
    ...m,
    count: row[m.key],
    percent: row.total ? (row[m.key] / row.total) * 100 : 0,
  }))
}

function summaryText(row) {
  const parts = []
  if (row.read) parts.push(`${row.read} read`)
  if (row.reading) parts.push(`${row.reading} reading`)
  if (row.want_to_read) parts.push(`${row.want_to_read} to read`)
  return parts.join(' · ')
}
</script>
