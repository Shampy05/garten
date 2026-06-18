<template>
  <div class="bg-gradient-to-br from-garden-50 to-emerald-50/60 rounded-xl border border-garden-100 p-3.5 mb-3">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[10px] font-semibold text-garden-600 uppercase tracking-wider">Growing together</div>
        <div class="flex items-baseline gap-2 mt-0.5 flex-wrap">
          <span class="text-lg font-display font-bold text-stone-800 tabular-nums">{{ fmtHours(togetherWeekMinutes) }}</span>
          <span class="text-xs text-stone-500">across your gardens this week</span>
        </div>
      </div>
      <button
        @click="social.shareWeeklySummary()"
        class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-garden-200 rounded-lg text-xs font-medium text-garden-700 hover:bg-garden-50 transition-colors"
        title="Share your weekly harvest with the circle"
      >
        <Share2 :size="13" />
        Share harvest
      </button>
    </div>

    <!-- Who's tending today lives here, next to the weekly total -->
    <WhosTendingToday class="mt-3 pt-3 border-t border-garden-100/70" />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { Share2 } from 'lucide-vue-next'
import WhosTendingToday from './WhosTendingToday.vue'

const social = inject('social')
const { togetherWeekMinutes } = social

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
