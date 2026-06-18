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

    <div v-if="friendBars.length > 0" class="mt-2.5 flex flex-wrap gap-2">
      <div
        v-for="bar in friendBars"
        :key="bar.id"
        class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/70 border border-garden-100/50"
      >
        <div
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          :class="bar.isSelf ? 'bg-stone-200 text-stone-600' : 'bg-garden-100 text-garden-700'"
        >
          {{ bar.name[0].toUpperCase() }}
        </div>
        <span class="text-xs text-stone-600 font-medium">{{ fmtHours(bar.minutes) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Share2 } from 'lucide-vue-next'

const social = inject('social')
const { profile, ownWeeklyMinutes, friends, togetherWeekMinutes } = social

const friendBars = computed(() => {
  const me = profile.value
  const bars = []
  if (me && ownWeeklyMinutes.value > 0) {
    bars.push({
      id: me.id,
      name: me.display_name || me.username || 'You',
      isSelf: true,
      minutes: ownWeeklyMinutes.value
    })
  }
  for (const f of friends.value) {
    if ((f.minutes_this_week || 0) > 0) {
      bars.push({
        id: f.friend_id,
        name: f.display_name || f.username,
        isSelf: false,
        minutes: f.minutes_this_week
      })
    }
  }
  return bars.sort((a, b) => b.minutes - a.minutes)
})

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
