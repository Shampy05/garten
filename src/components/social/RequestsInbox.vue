<template>
  <div
    v-if="incomingRequests.length || outgoingRequests.length"
    class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6"
  >
    <h3 class="font-display text-lg font-semibold text-gray-800 mb-3">Requests</h3>

    <!-- Incoming -->
    <div v-if="incomingRequests.length" class="space-y-1.5">
      <div v-for="r in incomingRequests" :key="r.id" class="flex items-center gap-3 p-2 rounded-lg">
        <div class="w-8 h-8 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
          {{ initial(r.requester) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-gray-700 truncate">{{ name(r.requester) }}</div>
          <div class="text-xs text-gray-400 truncate">wants to grow together</div>
        </div>
        <button
          @click="social.acceptRequest(r.id)"
          class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Check :size="13" /> Accept
        </button>
        <button
          @click="social.removeFriendship(r.id)"
          class="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors"
          title="Decline"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Outgoing -->
    <div v-if="outgoingRequests.length" class="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
      <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-1">Sent</div>
      <div v-for="r in outgoingRequests" :key="r.id" class="flex items-center gap-3 p-2 rounded-lg">
        <div class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
          {{ initial(r.addressee) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-gray-700 truncate">{{ name(r.addressee) }}</div>
          <div class="text-xs text-gray-400 truncate">pending…</div>
        </div>
        <button
          @click="social.removeFriendship(r.id)"
          class="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 transition-colors"
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
const { incomingRequests, outgoingRequests } = social

function name(p) {
  return p?.display_name || p?.username || 'A gardener'
}
function initial(p) {
  return name(p)[0].toUpperCase()
}
</script>
