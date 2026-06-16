<template>
  <div>
    <!-- Opt-in gate: no profile means you're invisible, exactly like before -->
    <UsernameGate v-if="profileLoaded && !profile" />

    <!-- First load of the profile -->
    <div v-else-if="!profileLoaded" class="flex items-center justify-center py-20">
      <div class="w-7 h-7 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Social home -->
    <div v-else class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-2xl sm:text-3xl font-bold text-gray-900">Your garden circle</h2>
            <p class="text-sm text-gray-500 mt-1">Tend alongside the people you're learning with.</p>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-medium text-gray-700">@{{ profile.username }}</div>
            <button
              @click="social.toggleDiscoverable()"
              class="mt-0.5 inline-flex items-center gap-1 text-xs transition-colors"
              :class="profile.discoverable ? 'text-gray-400 hover:text-gray-600' : 'text-amber-600 hover:text-amber-700'"
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

const social = inject('social')
const { profile, profileLoaded } = social

onMounted(() => {
  social.refresh()
})
</script>
