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
      <!-- Circle pulse: identity + live presence + this-week total in one hero -->
      <div class="gp-card gp-pad relative overflow-hidden animate-grow-in">
        <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/70 to-transparent"></div>
        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
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

        <!-- Live status line -->
        <div class="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div class="inline-flex items-center gap-2">
            <span class="relative flex h-2.5 w-2.5">
              <span
                v-if="focusingNow.length > 0"
                class="absolute inline-flex h-full w-full rounded-full bg-garden-400 animate-breathe"
              ></span>
              <span
                class="relative inline-flex h-2.5 w-2.5 rounded-full"
                :class="focusingNow.length > 0 ? 'bg-garden-500' : 'bg-stone-300'"
              ></span>
            </span>
            <span class="text-sm text-stone-600">
              <template v-if="focusingNow.length > 0">
                <span class="font-semibold text-stone-800">{{ focusingNow.length }}</span>
                {{ focusingNow.length === 1 ? 'gardener' : 'gardeners' }} focusing now
              </template>
              <template v-else>No one's focusing right now</template>
            </span>
          </div>

          <div class="inline-flex items-baseline gap-1.5">
            <span class="text-sm font-semibold text-stone-800 tabular-nums">{{ fmtHours(circleWeekMinutes) }}</span>
            <span class="text-sm text-stone-500">tended together this week</span>
          </div>
        </div>
      </div>

      <RequestsInbox />
      <BuddyInbox />
      <FocusSessions :languages="languages" />

      <!-- Empty circle: one inviting prompt instead of a row of dead cards -->
      <div
        v-if="friends.length === 0"
        class="gp-card gp-pad text-center animate-fade-up"
      >
        <div class="mx-auto w-12 h-12 rounded-full bg-garden-50 flex items-center justify-center mb-3">
          <Sprout :size="22" class="text-garden-500 animate-sway" />
        </div>
        <h3 class="gp-title text-lg">Plant your circle</h3>
        <p class="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
          Gardens grow better together. Add a friend to share commitments, focus
          sessions, and a friendly leaderboard.
        </p>
        <div class="mt-4 max-w-sm mx-auto text-left">
          <FriendSearch />
        </div>
      </div>

      <!-- Established circle: one tabbed panel instead of a stack of full cards -->
      <div v-else>
        <div class="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-stone-100/80 border border-line mb-4">
          <button
            v-for="t in tabs"
            :key="t.key"
            @click="activeTab = t.key"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            :class="activeTab === t.key ? 'bg-white text-garden-700 shadow-pill' : 'text-stone-500 hover:text-stone-700'"
          >
            {{ t.label }}
          </button>
        </div>

        <div :key="activeTab" class="animate-fade-up">
          <CircleLeaderboard v-if="activeTab === 'leaderboard'" />

          <CircleBooks
            v-else-if="activeTab === 'books'"
            :friend-books="friendBooks"
            :friends="friends"
          />

          <div v-else-if="activeTab === 'commitments'" class="space-y-6">
            <GrowBuddiesPanel
              @propose="showBuddyModal = true"
              @end="endBuddyPact"
            />
            <CommitmentsPanel
              :commitments="commitments"
              @add="openCommitmentModal(null)"
              @edit="openCommitmentModal"
              @delete="removeCommitment"
              @cheer="sendCheer"
              @nudge="sendNudge"
            />
          </div>

          <CelebrationFeed
            v-else-if="activeTab === 'celebrations'"
            :upcoming-milestones="upcomingMilestones"
          />
        </div>
      </div>

      <FriendsList />
      <FriendSearch v-if="friends.length > 0" />

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

      <ProposeBuddyModal
        :visible="showBuddyModal"
        :languages="availableLanguages"
        :friends="friends"
        @close="showBuddyModal = false"
        @propose="proposeBuddy"
      />
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted, ref, computed } from 'vue'
import { Eye, EyeOff, Sprout } from 'lucide-vue-next'
import UsernameGate from './UsernameGate.vue'
import FriendSearch from './FriendSearch.vue'
import RequestsInbox from './RequestsInbox.vue'
import FriendsList from './FriendsList.vue'
import DispatchDetail from './DispatchDetail.vue'
import FocusSessions from './FocusSessions.vue'
import CircleLeaderboard from './CircleLeaderboard.vue'
import CommitmentsPanel from './CommitmentsPanel.vue'
import SetCommitmentModal from './SetCommitmentModal.vue'
import CelebrationFeed from './CelebrationFeed.vue'
import BuddyInbox from './BuddyInbox.vue'
import GrowBuddiesPanel from './GrowBuddiesPanel.vue'
import ProposeBuddyModal from './ProposeBuddyModal.vue'
import CircleBooks from './CircleBooks.vue'

const props = defineProps({
  languages: { type: Array, default: () => [] },
  upcomingMilestones: { type: Array, default: () => [] }
})

const social = inject('social')
const { profile, profileLoaded, selectedEvent, commitments, friends, focusingNow, circleWeekMinutes, friendBooks } = social

const showCommitmentModal = ref(false)
const editingCommitment = ref(null)
const showBuddyModal = ref(false)

const availableLanguages = computed(() => props.languages)

const activeTab = ref('leaderboard')
const tabs = [
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'books', label: 'Books' },
  { key: 'commitments', label: 'Commitments' },
  { key: 'celebrations', label: 'Celebrations' }
]

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

async function proposeBuddy({ friendId, language, targetMinutes }) {
  const res = await social.proposeBuddyPact(friendId, language, targetMinutes)
  if (!res?.error) showBuddyModal.value = false
}

async function endBuddyPact(pact) {
  await social.endBuddyPact(pact.id)
}

async function sendCheer(commitment) {
  await social.sendNudge(commitment.user_id, 'cheer', commitment.id)
}

async function sendNudge(commitment) {
  await social.sendNudge(commitment.user_id, 'nudge', commitment.id)
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
