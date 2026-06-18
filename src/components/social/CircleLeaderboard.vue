<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h3 class="gp-title text-lg">Circle leaderboard</h3>
      <div class="inline-flex items-center p-0.5 rounded-lg bg-stone-100">
        <button
          v-for="w in windows"
          :key="w.key"
          @click="setWindow(w.key)"
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
          :class="window === w.key
            ? 'bg-white text-stone-800 shadow-sm'
            : 'text-stone-500 hover:text-stone-700'"
        >
          {{ w.label }}
        </button>
      </div>
    </div>

    <div v-if="leaderboard.length === 0" class="text-center py-8 text-stone-400">
      <Trophy :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No circle activity yet.</p>
      <p class="text-xs mt-1">Add friends to see the leaderboard grow.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="row in visibleRows"
        :key="row.user_id"
        class="flex items-center gap-3 p-3 rounded-xl border transition-colors"
        :class="rowClasses(row)"
      >
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          :class="rankClasses(row.rank)"
        >
          {{ row.rank }}
        </div>
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
          :class="row.isSelf ? 'bg-stone-100 text-stone-600' : 'bg-garden-50 text-garden-700'"
        >
          {{ (row.display_name || row.username)[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-stone-700 truncate">
              {{ row.isSelf ? 'You' : (row.display_name || row.username) }}
            </span>
            <span
              v-if="row.current_streak > 0"
              class="text-xs font-medium text-orange-500 flex-shrink-0"
            >
              {{ row.current_streak }}d
            </span>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-sm font-bold text-stone-800 tabular-nums">{{ fmtHours(row.minutes) }}</div>
          <div class="text-[10px] text-stone-400 uppercase tracking-wide">hours</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Trophy } from 'lucide-vue-next'

const social = inject('social')
const { leaderboard, leaderboardWindow } = social

const window = leaderboardWindow
const windows = [
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'all_time', label: 'All time' }
]

function setWindow(w) {
  if (window.value === w) return
  social.loadLeaderboard(w)
}

const visibleRows = computed(() => {
  const top = leaderboard.value.slice(0, 5)
  const me = leaderboard.value.find((r) => r.isSelf)
  if (!me || top.some((r) => r.isSelf)) return top
  return [...top, me]
})

// Garden palette, not medal colors: deepest green leads, lighter tints follow,
// and you always carry a subtle ring so you can spot yourself in the row.
function rowClasses(row) {
  if (row.isSelf) return 'bg-garden-50/50 border-garden-200 ring-1 ring-garden-100'
  if (row.rank === 1) return 'bg-garden-50/60 border-garden-100'
  return 'bg-white border-stone-100 hover:border-stone-200'
}

function rankClasses(rank) {
  if (rank === 1) return 'bg-garden-600 text-white shadow-sm'
  if (rank === 2) return 'bg-garden-100 text-garden-700'
  if (rank === 3) return 'bg-garden-50 text-garden-600'
  return 'bg-stone-100 text-stone-500'
}

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
