<template>
  <div
    v-if="pendingBuddyPacts.length || outgoingBuddyPacts.length"
    class="gp-card gp-pad"
  >
    <h3 class="gp-title text-lg mb-3">Grow buddy invites</h3>

    <!-- Incoming: someone wants to grow a language with you. -->
    <div v-if="pendingBuddyPacts.length" class="space-y-1.5">
      <div v-for="p in pendingBuddyPacts" :key="p.id" class="flex items-center gap-3 p-2 rounded-lg">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0"
          :style="{ backgroundColor: p.language_color }"
        >
          {{ p.buddy_name[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-stone-700 truncate">{{ p.buddy_name }}</div>
          <div class="text-xs text-stone-400 truncate">
            grow {{ p.language_name }} together · {{ fmtHours(p.target_minutes) }}/week
          </div>
        </div>
        <button
          @click="social.acceptBuddyPact(p.id)"
          class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-garden-700 bg-garden-50 hover:bg-garden-100 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Check :size="13" /> Accept
        </button>
        <button
          @click="social.declineBuddyPact(p.id)"
          class="flex-shrink-0 text-stone-400 hover:text-stone-600 p-1.5 rounded-lg transition-colors"
          title="Decline"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Outgoing: waiting on your buddy to accept. -->
    <div v-if="outgoingBuddyPacts.length" class="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
      <div class="text-[10px] text-stone-400 font-semibold uppercase tracking-widest mb-1">Sent</div>
      <div v-for="p in outgoingBuddyPacts" :key="p.id" class="flex items-center gap-3 p-2 rounded-lg">
        <div class="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
          {{ p.buddy_name[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-stone-700 truncate">{{ p.buddy_name }}</div>
          <div class="text-xs text-stone-400 truncate">{{ p.language_name }} · pending…</div>
        </div>
        <button
          @click="social.declineBuddyPact(p.id)"
          class="flex-shrink-0 text-xs text-stone-400 hover:text-stone-600 px-2.5 py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { Check, X } from 'lucide-vue-next'

const social = inject('social')
const { pendingBuddyPacts, outgoingBuddyPacts } = social

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
