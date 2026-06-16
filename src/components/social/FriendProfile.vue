<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="close"></div>
      <div class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 w-full max-w-md z-10 max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 class="font-display font-semibold text-gray-800">Gardener profile</h3>
          <button @click="close" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X :size="18" />
          </button>
        </div>

        <div class="p-5 overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-display font-bold text-xl flex-shrink-0">
              {{ displayName[0].toUpperCase() }}
            </div>
            <div class="min-w-0">
              <h4 class="text-xl font-display font-bold text-gray-900 truncate">{{ displayName }}</h4>
              <p class="text-sm text-gray-500">@{{ friend.username }}</p>
              <div v-if="friend.current_streak > 0" class="mt-1 text-xs font-medium text-orange-500">
                {{ friend.current_streak }} day streak
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-3 gap-3 mt-5">
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <div class="text-lg font-display font-bold text-gray-800">{{ fmtHours(friend.minutes_this_week) }}</div>
              <div class="text-[10px] text-gray-400 uppercase tracking-wide">this week</div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <div class="text-lg font-display font-bold text-gray-800">{{ bloomsTogether.length }}</div>
              <div class="text-[10px] text-gray-400 uppercase tracking-wide">blooms</div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <div class="text-lg font-display font-bold text-green-700">{{ friendshipLevel.label }}</div>
              <div class="text-[10px] text-gray-400 uppercase tracking-wide">friendship</div>
            </div>
          </div>

          <!-- Their garden -->
          <div class="mt-5">
            <h5 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Their garden</h5>
            <div v-if="friend.active_languages && friend.active_languages.length" class="flex flex-wrap gap-2">
              <span
                v-for="lang in friend.active_languages"
                :key="lang.name"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-100 text-xs font-medium text-green-700"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color }"></span>
                {{ lang.name }}
              </span>
            </div>
            <p v-else class="text-sm text-gray-400 italic">No active languages in the last 14 days.</p>
          </div>

          <!-- Shared blooms -->
          <div v-if="sharedLanguages.length" class="mt-5">
            <h5 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Cross-pollinated</h5>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="lang in sharedLanguages"
                :key="lang.name"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-xs font-medium text-amber-700"
              >
                <Flower2 :size="12" />
                {{ lang.name }}
              </span>
            </div>
          </div>

          <!-- Recent blooms -->
          <div v-if="bloomsTogether.length" class="mt-5">
            <h5 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recent blooms</h5>
            <div class="space-y-2">
              <div
                v-for="b in bloomsTogether.slice(0, 6)"
                :key="b.id"
                class="flex items-center gap-2 text-sm text-gray-600 bg-amber-50/50 rounded-lg px-3 py-2"
              >
                <Flower2 :size="14" class="text-amber-500 flex-shrink-0" />
                <span>{{ bloomText(b) }}</span>
              </div>
            </div>
          </div>

          <p v-else class="mt-5 text-sm text-gray-500">
            No cross-pollinations yet. Log a session in one of their languages and watch a bloom appear.
          </p>

          <!-- Water exchange -->
          <div class="mt-5 space-y-1.5">
            <div v-if="hasWateredMe(friend.friend_id)" class="text-sm text-sky-700 bg-sky-50 rounded-lg px-3 py-2">
              They watered your garden today.
            </div>
            <div v-if="hasWatered(friend.friend_id)" class="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              You watered their garden today.
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-6 flex items-center gap-3">
            <WaterButton :recipient-id="friend.friend_id" :name="displayName" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject } from 'vue'
import { X, Flower2 } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth.js'
import WaterButton from './WaterButton.vue'

const props = defineProps({
  friend: { type: Object, required: true },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const social = inject('social')
const { feed, hasWatered, hasWateredMe } = social
const { userId } = useAuth()

const displayName = computed(() => props.friend.display_name || props.friend.username)

const bloomsTogether = computed(() => {
  const fid = props.friend.friend_id
  return feed.value.filter(
    (item) =>
      item.kind === 'bloom' &&
      item.language_name &&
      ((item.actor_id === fid && item.co_actor_id === userId.value) ||
        (item.co_actor_id === fid && item.actor_id === userId.value))
  )
})

const sharedLanguages = computed(() => {
  const map = new Map()
  for (const b of bloomsTogether.value) {
    if (!map.has(b.language_name)) {
      map.set(b.language_name, { name: b.language_name, color: b.language_color })
    }
  }
  return Array.from(map.values())
})

const friendshipLevel = computed(() => {
  const n = bloomsTogether.value.length
  if (n >= 10) return { label: 'In full bloom', color: 'text-pink-600' }
  if (n >= 5) return { label: 'Budding', color: 'text-amber-600' }
  if (n >= 2) return { label: 'Sprouting', color: 'text-green-600' }
  return { label: 'Seedling', color: 'text-stone-500' }
})

function close() {
  emit('close')
}

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

function bloomText(b) {
  const d = b.occurred_on
    ? new Date(b.occurred_on + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : ''
  return `${b.language_name} bloomed ${d ? `on ${d}` : 'recently'}`
}
</script>
