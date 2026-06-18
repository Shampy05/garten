<template>
  <div>
    <!-- Opt-in gate: no profile means you're invisible, exactly like before -->
    <UsernameGate v-if="profileLoaded && !profile" />

    <!-- First load of the profile -->
    <div v-else-if="!profileLoaded" class="flex flex-col items-center justify-center py-20">
      <div class="w-7 h-7 border-4 border-garden-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Social home -->
    <div v-else class="space-y-6">
      <div class="gp-card gp-pad relative overflow-hidden animate-grow-in">
        <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/70 to-transparent"></div>
        <div class="relative flex items-start justify-between gap-3">
          <div>
            <h2 class="gp-title text-2xl sm:text-3xl text-stone-900">Your garden circle</h2>
            <p class="text-sm text-stone-500 mt-1">Tend alongside the people you're learning with.</p>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-medium text-stone-700">@{{ profile.username }}</div>
            <button
              @click="social.toggleDiscoverable()"
              class="mt-0.5 inline-flex items-center gap-1 text-xs transition-colors"
              :class="profile.discoverable ? 'text-stone-400 hover:text-stone-600' : 'text-amber-600 hover:text-amber-700'"
              :title="profile.discoverable
                ? 'Friends can find you by username. Tap to hide.'
                : 'You are hidden from search. Tap to become discoverable.'"
            >
              <component :is="profile.discoverable ? Eye : EyeOff" :size="12" />
              {{ profile.discoverable ? 'Discoverable' : 'Hidden' }}
            </button>
          </div>
        </div>
      </div>

      <RequestsInbox />
      <ActivityFeed />
      <FriendsList />
      <FriendSearch />

      <DispatchDetail
        :visible="!!selectedEvent"
        @close="social.closeEventDetail()"
      />
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import UsernameGate from './UsernameGate.vue'
import FriendSearch from './FriendSearch.vue'
import RequestsInbox from './RequestsInbox.vue'
import ActivityFeed from './ActivityFeed.vue'
import FriendsList from './FriendsList.vue'
import DispatchDetail from './DispatchDetail.vue'

const social = inject('social')
const { profile, profileLoaded, selectedEvent } = social

onMounted(() => {
  social.refresh()
})
</script>
