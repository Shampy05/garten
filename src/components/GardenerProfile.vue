<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="close"></div>
      <div class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-line w-full max-w-md z-10 max-h-[88vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-stone-100">
          <h3 class="gp-title">{{ isSelf ? 'Your garden' : 'Gardener profile' }}</h3>
          <button @click="close" class="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors" aria-label="Close">
            <X :size="18" />
          </button>
        </div>

        <div class="p-5 overflow-y-auto">
          <!-- Identity -->
          <div class="flex items-center gap-3">
            <BloomAvatar :seed="seed" :hours="avatarHours" :variant="avatarVariant" :size="60" :name="displayName" />
            <div class="min-w-0">
              <h4 class="text-xl font-display font-bold text-stone-900 truncate">{{ displayName }}</h4>
              <p v-if="username" class="text-sm text-stone-500">@{{ username }}</p>
              <p v-else-if="isSelf" class="text-sm text-stone-400">No handle yet</p>
              <div v-if="streak > 0" class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-500">
                <Flame :size="12" /> {{ streak }} day streak
              </div>
            </div>
          </div>

          <!-- Bio -->
          <div class="mt-4">
            <!-- Self, with a profile: editable -->
            <template v-if="isSelf && self.profile">
              <div v-if="!bioEditing" class="flex items-start gap-2">
                <p class="text-sm text-stone-600 flex-1 whitespace-pre-line" :class="{ 'text-stone-400 italic': !bioText }">
                  {{ bioText || 'Add a line about what you\'re growing.' }}
                </p>
                <button @click="startBioEdit" class="flex-shrink-0 text-stone-400 hover:text-garden-600 p-1 rounded-lg hover:bg-stone-50 transition-colors" aria-label="Edit bio">
                  <Pencil :size="14" />
                </button>
              </div>
              <div v-else>
                <textarea
                  v-model="bioDraft"
                  rows="2"
                  maxlength="160"
                  placeholder="What are you growing, and why?"
                  class="gp-input text-sm resize-none w-full"
                ></textarea>
                <div class="flex items-center justify-between mt-1.5">
                  <span class="text-[10px] text-stone-400 tabular-nums">{{ bioDraft.length }}/160</span>
                  <div class="flex items-center gap-2">
                    <button @click="bioEditing = false" class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
                    <button @click="saveBio" class="text-xs font-semibold text-garden-600 hover:text-garden-700 inline-flex items-center gap-1">
                      <Check :size="13" /> Save
                    </button>
                  </div>
                </div>
              </div>
            </template>
            <!-- Self, no profile yet: gentle nudge -->
            <div v-else-if="isSelf" class="rounded-xl bg-garden-50/60 border border-garden-100 p-3">
              <p class="text-xs text-stone-600">Choose a handle to add a bio, personalise your bloom, and be found by friends.</p>
              <button @click="emit('go-to-friends')" class="mt-1.5 text-xs font-semibold text-garden-700 hover:text-garden-800">
                Set up your handle →
              </button>
            </div>
            <!-- Friend: read-only, only when present -->
            <p v-else-if="bioText" class="text-sm text-stone-600 whitespace-pre-line">{{ bioText }}</p>
          </div>

          <!-- Bloom picker (self with profile). flex-wrap so the row folds
               onto a second line if more blooms are added later, rather
               than overflowing the modal on narrow screens. -->
          <div v-if="isSelf && self.profile" class="mt-4">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Your bloom</h5>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="(b, i) in blooms"
                :key="b.name"
                @click="pickVariant(i)"
                class="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                :class="avatarVariant === i ? 'ring-2 ring-offset-1 ring-stone-400' : ''"
                :style="{ backgroundColor: b.petal }"
                :title="`${b.name} bloom`"
                :aria-label="`${b.name} bloom`"
              >
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: b.center }"></span>
              </button>
            </div>
            <p v-if="avatarVariant == null" class="text-[10px] text-stone-400 mt-1.5">
              Showing your default bloom (hashed from your id). Pick a colour above to personalise.
            </p>
            <p v-else class="text-[10px] text-stone-400 mt-1.5">
              Tap the swatch again to go back to the default.
            </p>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-3 gap-3 mt-5">
            <div v-for="tile in statTiles" :key="tile.label" class="bg-stone-50 rounded-xl p-3 text-center">
              <div class="text-lg font-display font-bold text-stone-800 truncate px-1" :style="tile.color ? { color: tile.color } : {}">
                {{ tile.value }}
              </div>
              <div class="text-[10px] text-stone-400 uppercase tracking-wide">{{ tile.label }}</div>
            </div>
          </div>

          <!-- Weekly goal (self) -->
          <div v-if="isSelf && self.goalHours" class="mt-5">
            <div class="flex items-center justify-between mb-1.5">
              <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide">This week</h5>
              <span class="text-xs font-semibold text-stone-600 tabular-nums">{{ (self.weekMinutes / 60).toFixed(1) }}h / {{ self.goalHours }}h</span>
            </div>
            <div class="w-full bg-stone-100 rounded-full h-2 overflow-hidden ring-1 ring-inset ring-black/5">
              <div class="h-2 rounded-full bg-gradient-to-r from-garden-400 to-garden-600 transition-all duration-700" :style="{ width: weeklyPct + '%' }"></div>
            </div>
          </div>

          <!-- Languages: self horizons -->
          <div v-if="isSelf && horizons.length" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Your languages</h5>
            <div class="space-y-2.5">
              <div v-for="row in horizons" :key="row.id">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: row.color }"></span>
                    <span class="text-sm text-stone-700 truncate">{{ row.name }}</span>
                    <span v-if="row.level" class="text-[10px] font-semibold text-garden-700 bg-garden-50 border border-garden-100 rounded px-1 py-0.5 leading-none flex-shrink-0">{{ row.level }}</span>
                  </div>
                  <span class="text-xs text-stone-400 tabular-nums flex-shrink-0">{{ fmtHoursShort(row.hours) }}</span>
                </div>
                <div class="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div class="h-1.5 rounded-full transition-all duration-700" :style="{ width: row.pct + '%', backgroundColor: row.color }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Languages: friend active languages -->
          <div v-if="!isSelf" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Their garden</h5>
            <div v-if="friendLanguages.length" class="flex flex-wrap gap-2">
              <span
                v-for="lang in friendLanguages"
                :key="lang.name"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-garden-50 border border-garden-100 text-xs font-medium text-garden-700"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color }"></span>
                {{ lang.name }}
              </span>
            </div>
            <p v-else class="text-sm text-stone-400 italic">No active languages in the last 14 days.</p>
          </div>

          <!-- Currently reading (self) -->
          <div v-if="isSelf && currentBook" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Currently reading</h5>
            <div class="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
              <div class="w-10 h-14 rounded bg-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img v-if="currentBook.coverUrl" :src="currentBook.coverUrl" :alt="currentBook.title" class="w-full h-full object-cover" />
                <BookOpen v-else :size="18" class="text-stone-400" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-stone-700 truncate">{{ currentBook.title }}</p>
                <p v-if="currentBook.author" class="text-xs text-stone-400 truncate">{{ currentBook.author }}</p>
                <div v-if="currentBook.totalPages" class="mt-1.5 flex items-center gap-2">
                  <div class="flex-1 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div class="h-1.5 rounded-full bg-garden-500 transition-all duration-700" :style="{ width: currentBook.pct + '%' }"></div>
                  </div>
                  <span class="text-[10px] text-stone-400 tabular-nums flex-shrink-0">{{ currentBook.pct }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Milestones (self) -->
          <div v-if="isSelf && milestones.length" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Recent milestones</h5>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="m in milestones"
                :key="m.key"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-xs font-medium text-amber-700"
              >
                <component :is="milestoneIcon(m.icon)" :size="12" />
                {{ m.label }}
              </span>
            </div>
          </div>

          <!-- Cross-pollinated (friend) -->
          <div v-if="!isSelf && sharedLanguages.length" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Cross-pollinated</h5>
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

          <!-- Recent celebrations (friend) -->
          <div v-if="!isSelf && recentCelebrations.length" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Recently</h5>
            <div class="space-y-1.5">
              <div v-for="c in recentCelebrations" :key="c.id" class="flex items-center gap-2 text-sm text-stone-600">
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ backgroundColor: c.language_color || '#a8a29e' }"></span>
                <span class="truncate">{{ describeCelebration(c) }}</span>
              </div>
            </div>
          </div>

          <p v-if="!isSelf && !sharedLanguages.length" class="mt-5 text-sm text-stone-500">
            No cross-pollinations yet. Log a session in one of their languages and watch a bloom appear.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { X, Flower2, Pencil, Check, Flame, Clock, BookOpen, Sprout } from 'lucide-vue-next'
import BloomAvatar from './BloomAvatar.vue'
import { useAuth } from '../composables/useAuth.js'
import { useBooks } from '../composables/useBooks.js'
import { BLOOMS } from '../lib/avatar.js'
import { languageHorizons, currentReadingBook, selfMilestones } from '../lib/profileStats.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'self' }, // 'self' | 'friend'
  // Self inputs (null in friend mode). See App.vue's selfProfileInput.
  self: { type: Object, default: null },
  // Friend inputs (null in self mode). Base friend row + fetched bio/variant.
  friend: { type: Object, default: null },
})

const emit = defineEmits(['close', 'save-bio', 'save-variant', 'go-to-friends'])

const isSelf = computed(() => props.mode === 'self')
const blooms = BLOOMS

// Friend-mode reactivity mirrors the old FriendProfile: shared blooms and the
// friend's recent celebrations are read live from the shared social state.
const social = inject('social', null)
const { userId } = useAuth()

// Books power the "currently reading" card. useBooks is a module singleton with
// its own cache, so touching it here lazy-loads at most once on first open and
// shares state with the Library — it never double-fetches.
const { savedBooks } = useBooks()

// ── Identity ────────────────────────────────────────────────────────────────
const displayName = computed(() => {
  if (isSelf.value) {
    return props.self?.profile?.display_name || props.self?.profile?.username || emailName.value || 'You'
  }
  return props.friend?.display_name || props.friend?.username || 'A gardener'
})
const emailName = computed(() => (props.self?.email ? props.self.email.split('@')[0] : ''))
const username = computed(() =>
  isSelf.value ? props.self?.profile?.username || null : props.friend?.username || null
)
const seed = computed(() => (isSelf.value ? props.self?.userId || '' : props.friend?.friend_id || ''))
const avatarHours = computed(() => (isSelf.value ? props.self?.totalHours ?? null : null))
const avatarVariant = computed(() =>
  isSelf.value ? props.self?.profile?.avatar_variant ?? null : props.friend?.avatar_variant ?? null
)
const streak = computed(() => (isSelf.value ? props.self?.streak || 0 : props.friend?.current_streak || 0))

// ── Bio editing (self) ──────────────────────────────────────────────────────
const bioText = computed(() =>
  isSelf.value ? props.self?.profile?.bio || '' : props.friend?.bio || ''
)
const bioEditing = ref(false)
const bioDraft = ref('')
function startBioEdit() {
  bioDraft.value = bioText.value
  bioEditing.value = true
}
function saveBio() {
  emit('save-bio', bioDraft.value.trim())
  bioEditing.value = false
}
// Reset the editor whenever the modal is reopened.
watch(() => props.visible, (v) => { if (!v) bioEditing.value = false })

function pickVariant(i) {
  emit('save-variant', avatarVariant.value === i ? null : i)
}

// ── Self derived views ──────────────────────────────────────────────────────
const horizons = computed(() =>
  isSelf.value ? languageHorizons(props.self?.entries || [], props.self?.languages || [], props.self?.nativeLanguage) : []
)
const currentBook = computed(() => (isSelf.value ? currentReadingBook(savedBooks.value) : null))
const milestones = computed(() =>
  isSelf.value
    ? selfMilestones({
        entries: props.self?.entries || [],
        languages: props.self?.languages || [],
        savedBooks: savedBooks.value,
        nativeLanguage: props.self?.nativeLanguage,
      })
    : []
)
const weeklyPct = computed(() => {
  const goalMin = (props.self?.goalHours || 0) * 60
  if (goalMin <= 0) return 0
  return Math.min(100, ((props.self?.weekMinutes || 0) / goalMin) * 100)
})

// ── Stat tiles ──────────────────────────────────────────────────────────────
const statTiles = computed(() => {
  if (isSelf.value) {
    return [
      { label: 'total', value: fmtHoursShort(props.self?.totalHours || 0) },
      { label: 'streak', value: streak.value > 0 ? streak.value + 'd' : '—' },
      { label: 'languages', value: String(horizons.value.length) },
    ]
  }
  return [
    { label: 'this week', value: fmtHours(props.friend?.minutes_this_week) },
    { label: 'top language', value: topLanguageName.value || '—' },
    { label: 'streak', value: streak.value > 0 ? streak.value + 'd' : '—' },
  ]
})

// ── Friend derived views ────────────────────────────────────────────────────
const friendLanguages = computed(() => props.friend?.active_languages || [])

const topLanguageName = computed(() => {
  const bd = social?.circleBreakdown?.value?.[props.friend?.friend_id]
  return bd?.languages?.[0]?.name || props.friend?.active_languages?.[0]?.name || null
})

const bloomsTogether = computed(() => {
  if (isSelf.value || !social) return []
  const fid = props.friend?.friend_id
  return social.feed.value.filter(
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
    if (!map.has(b.language_name)) map.set(b.language_name, { name: b.language_name, color: b.language_color })
  }
  return Array.from(map.values())
})

const recentCelebrations = computed(() => {
  if (isSelf.value || !social) return []
  const fid = props.friend?.friend_id
  return social.feed.value
    .filter((item) => item.actor_id === fid && ['milestone', 'bloom', 'new_language', 'commitment_progress'].includes(item.kind))
    .slice(0, 4)
})

function describeCelebration(c) {
  switch (c.kind) {
    case 'new_language':
      return `Planted ${c.language_name || 'a new language'}`
    case 'bloom':
      return c.language_name ? `Cross-pollinated ${c.language_name}` : 'Grew a bloom'
    case 'commitment_progress':
      return c.language_name ? `Kept their ${c.language_name} commitment` : 'Kept a weekly commitment'
    case 'milestone':
      return c.streak_days ? `Reached a ${c.streak_days}-day streak` : 'Reached a milestone'
    default:
      return 'A moment in their garden'
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const ICONS = { clock: Clock, flame: Flame, sprout: Sprout, book: BookOpen }
function milestoneIcon(name) {
  return ICONS[name] || Sprout
}

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
function fmtHoursShort(hours) {
  const h = Number(hours) || 0
  if (h >= 100) return `${Math.round(h)}h`
  if (h >= 10) return `${h.toFixed(0)}h`
  return `${h.toFixed(1)}h`
}
</script>
