<template>
  <div
    v-if="incomingRequests.length || outgoingRequests.length"
    class="gp-card gp-pad"
  >
    <h3 class="gp-title text-lg mb-3">Requests</h3>

    <!-- Incoming -->
    <div v-if="incomingRequests.length" class="space-y-1.5">
      <div v-for="r in incomingRequests" :key="r.id" class="flex items-center gap-3 p-2 rounded-lg">
        <BloomAvatar :seed="r.requester?.id" :size="32" :name="name(r.requester)" :variant="r.requester?.avatar_variant" />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-stone-700 truncate">{{ name(r.requester) }}</div>
          <div class="text-xs text-stone-400 truncate">wants to grow together</div>
        </div>
        <button
          @click="social.acceptRequest(r.id)"
          class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-garden-700 bg-garden-50 hover:bg-garden-100 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Check :size="13" /> Accept
        </button>
        <button
          @click="social.removeFriendship(r.id)"
          class="flex-shrink-0 text-stone-400 hover:text-stone-600 p-1.5 rounded-lg transition-colors"
          title="Decline"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Outgoing -->
    <div v-if="outgoingRequests.length" class="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
      <div class="text-[10px] text-stone-400 font-semibold uppercase tracking-widest mb-1">Sent</div>
      <div v-for="r in outgoingRequests" :key="r.id" class="flex items-center gap-3 p-2 rounded-lg">
        <BloomAvatar :seed="r.addressee?.id" :size="32" :name="name(r.addressee)" :variant="r.addressee?.avatar_variant" />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-stone-700 truncate">{{ name(r.addressee) }}</div>
          <div class="text-xs text-stone-400 truncate">pending…</div>
        </div>
        <button
          @click="social.removeFriendship(r.id)"
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
import BloomAvatar from '../BloomAvatar.vue'

const social = inject('social')
const { incomingRequests, outgoingRequests } = social

function name(p) {
  return p?.display_name || p?.username || 'A gardener'
}
</script>
