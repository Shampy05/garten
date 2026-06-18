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
            <p class="text-sm text-stone-500 mt-1">Commit, focus, and grow alongside friends.</p>
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
      <FocusSessions :languages="languages" />
      <CircleLeaderboard />

      <!-- Commitments -->
      <div class="gp-card gp-pad">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="gp-title text-lg">This week's commitments</h3>
            <p class="text-xs text-stone-500 mt-0.5">Public promises keep the circle accountable.</p>
          </div>
          <button
            @click="openCommitmentModal(null)"
            class="gp-btn-primary px-3 py-2 text-xs"
          >
            <Target :size="14" /> Set commitment
          </button>
        </div>

        <div v-if="commitments.length === 0" class="text-center py-8 text-stone-400">
          <Target :size="28" class="mx-auto mb-2 text-stone-300" />
          <p class="text-sm">No commitments yet this week.</p>
          <p class="text-xs mt-1">Set one to let your circle know what you're growing.</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CommitmentCard
            v-for="c in commitments"
            :key="c.id"
            :commitment="c"
            @edit="openCommitmentModal"
            @delete="removeCommitment"
            @cheer="sendCheer"
            @nudge="sendNudge"
          />
        </div>
      </div>

      <CelebrationFeed />
      <FriendsList />
      <FriendSearch />

      <DispatchDetail
        :visible="!!selectedEvent"
        @close="social.closeEventDetail()"
      />

      <SetCommitmentModal
        :visible="showCommitmentModal"
        :languages="availableLanguages"
        :commitment="editingCommitment"
        @close="showCommitmentModal = false; editingCommitment = null"
        @save="saveCommitment"
      />
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted, ref, computed } from 'vue'
import { Eye, EyeOff, Target } from 'lucide-vue-next'
import UsernameGate from './UsernameGate.vue'
import FriendSearch from './FriendSearch.vue'
import RequestsInbox from './RequestsInbox.vue'
import FriendsList from './FriendsList.vue'
import DispatchDetail from './DispatchDetail.vue'
import FocusSessions from './FocusSessions.vue'
import CircleLeaderboard from './CircleLeaderboard.vue'
import CommitmentCard from './CommitmentCard.vue'
import SetCommitmentModal from './SetCommitmentModal.vue'
import CelebrationFeed from './CelebrationFeed.vue'

const props = defineProps({
  languages: { type: Array, default: () => [] }
})

const social = inject('social')
const { profile, profileLoaded, selectedEvent, commitments } = social

const showCommitmentModal = ref(false)
const editingCommitment = ref(null)

const availableLanguages = computed(() => props.languages)

onMounted(() => {
  social.refresh()
})

function openCommitmentModal(commitment) {
  editingCommitment.value = commitment
  showCommitmentModal.value = true
}

async function removeCommitment(commitment) {
  await social.deleteCommitment(commitment.id)
}

async function saveCommitment({ language, targetMinutes }) {
  await social.setCommitment(language, targetMinutes)
  showCommitmentModal.value = false
  editingCommitment.value = null
}

async function sendCheer(commitment) {
  await social.sendNudge(commitment.user_id, 'cheer', commitment.id)
}

async function sendNudge(commitment) {
  await social.sendNudge(commitment.user_id, 'nudge', commitment.id)
}
</script>
