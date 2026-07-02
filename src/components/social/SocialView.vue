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
            <p class="text-sm text-stone-500 mt-1">Grow alongside friends.</p>
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

        <!-- This-week total -->
        <div class="relative mt-4 inline-flex items-baseline gap-1.5">
          <span class="text-sm font-semibold text-stone-800 tabular-nums">{{ fmtHours(circleWeekMinutes) }}</span>
          <span class="text-sm text-stone-500">tended together this week</span>
        </div>
      </div>

      <RequestsInbox />

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
          Gardens grow better together. Add a friend to share weekly goals and
          a friendly leaderboard.
        </p>
        <div class="mt-4 max-w-sm mx-auto text-left">
          <FriendSearch />
        </div>
      </div>

      <!-- Established circle -->
      <div v-else class="space-y-6">
        <!-- Friends list sits above the tab panel — your circle is the context
             for the leaderboard, goals, and celebrations below it. -->
        <FriendsList @open-profile="openLeaderboardProfile" />

        <!-- Tabbed panel: Leaderboard · Commitments · Celebrations -->
        <div>
          <div class="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-stone-100/80 border border-line mb-4">
            <button
              v-for="t in tabs"
              :key="t.key"
              @click="setActiveTab(t.key)"
              class="relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              :class="activeTab === t.key ? 'bg-white text-garden-700 shadow-pill' : 'text-stone-500 hover:text-stone-700'"
            >
              {{ t.label }}
              <!-- Celebration badge: quiet dot when there's unseen friend activity -->
              <span
                v-if="t.key === 'celebrations' && hasCelebrationBadge"
                class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-garden-500"
              ></span>
            </button>
          </div>

          <div :key="activeTab" class="animate-fade-up">
            <CircleLeaderboard
              v-if="activeTab === 'leaderboard'"
              @open-profile="openLeaderboardProfile"
            />

            <WeeklyGoalsPanel
              v-else-if="activeTab === 'commitments'"
              :commitments="commitments"
              @add="openCommitmentModal(null)"
              @edit="openCommitmentModal"
              @delete="removeCommitment"
            />

            <CelebrationFeed
              v-else-if="activeTab === 'celebrations'"
              :upcoming-milestones="upcomingMilestones"
            />
          </div>
        </div>

        <FriendSearch />
      </div>

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

      <!-- Profile modal: opened from both the leaderboard and the friends list -->
      <FriendProfile
        v-if="leaderboardProfile"
        :friend="leaderboardProfile"
        :visible="true"
        @close="leaderboardProfile = null"
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
import CircleLeaderboard from './CircleLeaderboard.vue'
import FriendProfile from './FriendProfile.vue'
import WeeklyGoalsPanel from './WeeklyGoalsPanel.vue'
import SetCommitmentModal from './SetCommitmentModal.vue'
import CelebrationFeed from './CelebrationFeed.vue'

const props = defineProps({
  languages: { type: Array, default: () => [] },
  upcomingMilestones: { type: Array, default: () => [] }
})

const social = inject('social')
const {
  profile,
  profileLoaded,
  selectedEvent,
  commitments,
  friends,
  circleWeekMinutes,
  feed,
  leaderboard,
  circleBreakdown
} = social

// ── Profile modal ──────────────────────────────────────────────────────────
// Shared by both the leaderboard (via open-profile event) and the friends list
// (via open-profile event forwarded from FriendsList).
const leaderboardProfile = ref(null)

// ── Modals ─────────────────────────────────────────────────────────────────
const showCommitmentModal = ref(false)
const editingCommitment = ref(null)

const availableLanguages = computed(() => props.languages)

// ── Tabs ───────────────────────────────────────────────────────────────────
const activeTab = ref('leaderboard')
// Session-level flag: did the user look at Celebrations this session?
// Resets on every page load so fresh friend activity always surfaces a dot.
const celebrationsVisited = ref(false)

const tabs = [
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'commitments', label: 'Commitments' },
  { key: 'celebrations', label: 'Celebrations' }
]

// Show a small dot on the Celebrations tab when there are friend events from
// the last 24 hours and the user hasn't visited the tab this session.
const hasCelebrationBadge = computed(() => {
  if (celebrationsVisited.value) return false
  const cutoff = Date.now() - 86400000 // 24 h ago
  return feed.value.some((item) => {
    if (item.isSelf) return false
    return new Date(item.occurred_on + 'T00:00:00').getTime() >= cutoff
  })
})

function setActiveTab(key) {
  activeTab.value = key
  if (key === 'celebrations') celebrationsVisited.value = true
}

onMounted(() => {
  social.refresh()
})

// ── Commitment handlers ────────────────────────────────────────────────────
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

// ── Profile opening ────────────────────────────────────────────────────────
// Handles open-profile from both CircleLeaderboard and FriendsList.
// Prefers the full friend object (richer active-languages data) when available;
// falls back to leaderboard row + breakdown as a compatible shape.
function openLeaderboardProfile(userId) {
  const fromFriends = friends.value.find((f) => f.friend_id === userId)
  if (fromFriends) {
    leaderboardProfile.value = fromFriends
    return
  }
  const row = leaderboard.value.find((r) => r.user_id === userId)
  if (!row) return
  const bd = circleBreakdown.value[userId]
  leaderboardProfile.value = {
    friend_id: userId,
    username: row.username,
    display_name: row.display_name,
    current_streak: row.current_streak,
    minutes_this_week: row.minutes,
    active_languages: bd?.languages || []
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────
function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
