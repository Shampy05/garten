<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
    <h3 class="font-display text-lg font-semibold text-gray-800 mb-3">Garden dispatches</h3>

    <div v-if="feed.length === 0" class="text-center py-8 text-gray-400">
      <Sprout :size="28" class="mx-auto mb-2 text-gray-300" />
      <p class="text-sm">No dispatches yet.</p>
      <p class="text-xs mt-1">When you or a friend logs a session, it lands here.</p>
    </div>

    <div v-else>
      <div
        v-for="item in feed"
        :key="item.id"
        class="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0"
      >
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0 mt-0.5"
          :class="item.isSelf ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'"
        >
          {{ item.actorName[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-gray-700 leading-snug">
            <span class="font-medium">{{ item.isSelf ? 'You' : item.actorName }}</span>

            <template v-if="item.kind === 'session'">
              tended
              <span class="inline-flex items-center gap-1 align-baseline">
                <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                <span class="font-medium">{{ item.language_name || 'a language' }}</span>
              </span>
              for {{ fmtDuration(item.minutes) }}<span v-if="item.activity_type" class="text-gray-400"> · {{ item.activity_type }}</span>
            </template>

            <template v-else-if="item.kind === 'milestone'">
              reached a <span class="font-medium text-orange-500">{{ item.streak_days }}-day streak</span> in
              <span class="inline-flex items-center gap-1 align-baseline">
                <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                <span class="font-medium">{{ item.language_name || 'a language' }}</span>
              </span>
            </template>

            <template v-else-if="item.kind === 'summary'">
              spent <span class="font-medium">{{ fmtDuration(item.minutes) }}</span>
              in their<span v-if="item.language_name"> {{ item.language_name }}</span> garden this week
            </template>
          </p>
          <div class="text-xs text-gray-400 mt-0.5">{{ relDay(item.occurred_on) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { Sprout } from 'lucide-vue-next'

const social = inject('social')
const { feed } = social

function fmtDuration(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

// Date-granular relative label from the study date (occurred_on), matching the
// app's day-centric feel. Dispatches are ordered by when they were logged, but
// read in terms of the day they happened.
function relDay(dateStr) {
  if (!dateStr) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((today - d) / 86400000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>
