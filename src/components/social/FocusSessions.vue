<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h3 class="gp-title text-lg">Focus sessions</h3>
        <div class="mt-0.5 flex items-center gap-1.5">
          <span v-if="focusingNow.length > 0" class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full rounded-full bg-garden-400 animate-breathe"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-garden-500"></span>
          </span>
          <p class="text-xs text-stone-500">
            <template v-if="focusingNow.length > 0">
              <span class="font-medium text-garden-700">{{ liveLabel }}</span> focusing now
            </template>
            <template v-else>Study alongside your circle in real time.</template>
          </p>
        </div>
      </div>
      <button
        @click="showStart = true"
        class="gp-btn-primary px-3 py-2 text-xs"
        :disabled="hasActiveFocusSession"
      >
        <Zap :size="14" /> Start session
      </button>
    </div>

    <div v-if="myActiveSession" class="mb-4 p-4 rounded-xl bg-garden-50 border border-garden-100">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="relative flex-shrink-0">
            <span
              class="absolute inset-0 rounded-full animate-breathe"
              :style="{ backgroundColor: myActiveSession.language_color, opacity: 0.35 }"
            ></span>
            <div
              class="relative w-10 h-10 rounded-full flex items-center justify-center"
              :style="{ backgroundColor: myActiveSession.language_color }"
            >
              <Timer :size="18" class="text-white/90" />
            </div>
          </div>
          <div>
            <div class="text-sm font-semibold text-stone-800">
              Focusing on {{ myActiveSession.language_name }}
            </div>
            <div class="text-xs text-stone-500">
              {{ myActiveSession.duration_minutes }} min · {{ myActiveSession.activity_type }}
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-display font-bold text-garden-700 tabular-nums">
            {{ remainingLabel }}
          </div>
          <button
            @click="cancelMySession"
            class="text-xs text-stone-400 hover:text-red-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div v-if="friendActiveSessions.length > 0" class="space-y-2">
      <div
        v-for="s in friendActiveSessions"
        :key="s.id"
        class="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-stone-100"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center"
              :style="{ backgroundColor: s.language_color }"
            >
              <span class="text-white text-xs font-bold">{{ s.ownerName[0].toUpperCase() }}</span>
            </div>
            <span class="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span class="absolute inline-flex h-full w-full rounded-full bg-garden-400 animate-breathe"></span>
              <span class="relative inline-flex h-3 w-3 rounded-full bg-garden-500 ring-2 ring-white"></span>
            </span>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-stone-700 truncate">
              {{ s.ownerName }} is focusing on {{ s.language_name }}
            </div>
            <div class="text-xs text-stone-400">
              {{ s.duration_minutes }} min · {{ timeLeft(s) }} left
            </div>
          </div>
        </div>
        <button
          @click="join(s)"
          class="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-garden-700 bg-garden-50 hover:bg-garden-100 transition-colors"
          :disabled="hasActiveFocusSession"
        >
          <Zap :size="13" /> Join
        </button>
      </div>
    </div>

    <div v-else-if="!myActiveSession" class="text-center py-8 text-stone-400">
      <Zap :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No one is focusing right now.</p>
      <p class="text-xs mt-1">Start a session and invite your circle to join.</p>
    </div>

    <StartFocusSessionModal
      :visible="showStart"
      :languages="languages"
      @close="showStart = false"
      @start="onStart"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import { Zap, Timer } from 'lucide-vue-next'
import StartFocusSessionModal from './StartFocusSessionModal.vue'

defineProps({
  languages: { type: Array, default: () => [] }
})

const social = inject('social')
const { focusSessions, hasActiveFocusSession, focusingNow } = social

const showStart = ref(false)
const now = ref(Date.now())
let tick = null

onMounted(() => {
  social.expireFocusSessions()
  tick = setInterval(() => {
    now.value = Date.now()
    if (myActiveSession.value && remainingMs.value <= 0) {
      completeMySession()
    }
  }, 1000)
})

onUnmounted(() => {
  if (tick) clearInterval(tick)
})

// Compact, human label for who's focusing — "You + 2 others", "Maria", etc.
const liveLabel = computed(() => {
  const names = focusingNow.value.map((g) => g.name)
  if (names.length === 0) return ''
  // Surface "You" first if present.
  names.sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0))
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} + ${names[1]}`
  return `${names[0]} + ${names.length - 1} others`
})

const myActiveSession = computed(() =>
  focusSessions.value.find((s) => s.isSelf && s.status === 'active')
)

// Hide friends' expired sessions live — expiry only auto-completes the caller's
// own rows server-side, so a finished friend session would otherwise linger as
// "active" until they reopen the app. The ticking `now` keeps this reactive.
const friendActiveSessions = computed(() =>
  focusSessions.value.filter(
    (s) => !s.isSelf && s.status === 'active' && new Date(s.ends_at).getTime() > now.value
  )
)

const remainingMs = computed(() => {
  if (!myActiveSession.value) return 0
  const end = new Date(myActiveSession.value.ends_at).getTime()
  return Math.max(0, end - now.value)
})

const remainingLabel = computed(() => {
  const ms = remainingMs.value
  const totalSeconds = Math.ceil(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

function timeLeft(session) {
  const end = new Date(session.ends_at).getTime()
  const ms = Math.max(0, end - now.value)
  const totalSeconds = Math.ceil(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function onStart({ language, durationMinutes, activityType }) {
  showStart.value = false
  await social.startFocusSession(language, durationMinutes, activityType)
}

async function join(session) {
  await social.joinFocusSession(session.id)
}

async function cancelMySession() {
  if (!myActiveSession.value) return
  await social.cancelFocusSession(myActiveSession.value.id)
}

async function completeMySession() {
  if (!myActiveSession.value) return
  await social.completeFocusSession(myActiveSession.value.id)
}
</script>
