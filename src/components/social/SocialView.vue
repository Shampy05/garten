<template>
  <div>
    <!-- Opt-in gate: no profile means you're invisible, exactly like before -->
    <UsernameGate v-if="profileLoaded && !profile" />

    <!-- First load of the profile -->
    <div v-else-if="!profileLoaded" class="flex flex-col items-center justify-center py-20">
      <div class="w-7 h-7 border-4 border-garden-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Social home: one calm column — hero, requests, friends, leaderboard,
         weekly goals, celebrations. No tabs; each card is one clear thing. -->
    <div v-else class="space-y-6">
      <div class="gp-card gp-pad relative overflow-hidden animate-grow-in">
        <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/70 to-transparent"></div>
        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="gp-title text-2xl sm:text-3xl text-stone-900">Friends</h2>
            <p class="text-sm text-stone-500 mt-1">{{ heroLine }}</p>
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

        <div v-if="friends.length > 0" class="relative mt-4 inline-flex items-baseline gap-1.5">
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
      <template v-else>
        <FriendsList @open-profile="openFriendProfile" />

        <CircleLeaderboard @open-profile="openFriendProfile" />

        <WeeklyGoalsPanel
          :commitments="commitments"
          @add="openCommitmentModal(null)"
          @edit="openCommitmentModal"
          @delete="removeCommitment"
        />

        <CelebrationFeed />

        <FriendSearch />
      </template>

      <SetCommitmentModal
        :visible="showCommitmentModal"
        :languages="languages"
        :commitment="editingCommitment"
        @close="showCommitmentModal = false; editingCommitment = null"
        @save="saveCommitment"
      />

      <!-- Profile modal: opened from both the leaderboard and the friends list -->
      <FriendProfile
        v-if="friendProfile"
        :friend="friendProfile"
        :visible="true"
        @close="friendProfile = null"
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
import CircleLeaderboard from './CircleLeaderboard.vue'
import FriendProfile from './FriendProfile.vue'
import WeeklyGoalsPanel from './WeeklyGoalsPanel.vue'
import SetCommitmentModal from './SetCommitmentModal.vue'
import CelebrationFeed from './CelebrationFeed.vue'

defineProps({
  languages: { type: Array, default: () => [] }
})

const social = inject('social')
const {
  profile,
  profileLoaded,
  commitments,
  friends,
  circleWeekMinutes,
  leaderboard,
  circleBreakdown
} = social

// ── Hero ───────────────────────────────────────────────────────────────────
// "You and 3 friends are growing Spanish & French." — presence in one line,
// built from the friends' recently active languages.
const heroLine = computed(() => {
  const n = friends.value.length
  if (n === 0) return 'Grow alongside friends.'
  const names = []
  for (const f of friends.value) {
    for (const lang of f.active_languages || []) {
      if (!names.includes(lang.name)) names.push(lang.name)
    }
  }
  const who = n === 1 ? 'You and 1 friend are' : `You and ${n} friends are`
  if (names.length === 0) return `${who} growing together.`
  const shown = names.slice(0, 3)
  const list = shown.length === 1
    ? shown[0]
    : shown.slice(0, -1).join(', ') + ' & ' + shown[shown.length - 1]
  const more = names.length > 3 ? ' and more' : ''
  return `${who} growing ${list}${more}.`
})

// ── Profile modal ──────────────────────────────────────────────────────────
// Shared by the leaderboard and the friends list. Prefers the full friend
// object (richer active-languages data); falls back to leaderboard row +
// breakdown as a compatible shape.
const friendProfile = ref(null)

function openFriendProfile(userId) {
  const fromFriends = friends.value.find((f) => f.friend_id === userId)
  if (fromFriends) {
    friendProfile.value = fromFriends
    return
  }
  const row = leaderboard.value.find((r) => r.user_id === userId)
  if (!row) return
  const bd = circleBreakdown.value[userId]
  friendProfile.value = {
    friend_id: userId,
    username: row.username,
    display_name: row.display_name,
    current_streak: row.current_streak,
    minutes_this_week: row.minutes,
    active_languages: bd?.languages || []
  }
}

// ── Commitments ────────────────────────────────────────────────────────────
const showCommitmentModal = ref(false)
const editingCommitment = ref(null)

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

onMounted(() => {
  social.refresh()
})

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
