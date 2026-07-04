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
            <BloomAvatar :seed="seed" :hours="avatarHours" :variant="avatarVariant" :companion="avatarCompanion" :size="60" :name="displayName" />
            <div class="min-w-0">
              <h4 class="text-xl font-display font-bold text-stone-900 truncate">{{ displayName }}</h4>
              <p v-if="username" class="text-sm text-stone-500">@{{ username }}</p>
              <p v-else-if="isSelf" class="text-sm text-stone-400">No handle yet</p>
              <div v-if="streak > 0" class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-500">
                <Flame :size="12" /> {{ streak }} day streak
              </div>
              <p v-if="isSelf && plantedLabel" class="mt-0.5 text-xs text-stone-400">{{ plantedLabel }}</p>
            </div>
          </div>

          <!-- Friend's garden name: read-only personalisation the friend has set
               on their profile. Rendered as a quiet line so the modal still
               feels like their garden at a glance. -->
          <p v-if="!isSelf && friendGardenName" class="mt-2 text-sm font-display text-stone-700">
            {{ friendGardenName }}
          </p>

          <!-- Garden name (self with profile). The same pencil-to-edit pattern as
               the bio, so the personalisation surfaces have a consistent feel. -->
          <div v-if="isSelf && self.profile" class="mt-3">
            <div v-if="!gardenNameEditing" class="flex items-start gap-2">
              <p class="text-sm text-stone-600 flex-1" :class="{ 'text-stone-400 italic': !gardenName }">
                <span v-if="gardenName" class="font-display text-base text-stone-800">{{ gardenName }}</span>
                <span v-else>Name your garden</span>
              </p>
              <button @click="startGardenNameEdit" class="flex-shrink-0 text-stone-400 hover:text-garden-600 p-1 rounded-lg hover:bg-stone-50 transition-colors" aria-label="Edit garden name">
                <Pencil :size="14" />
              </button>
            </div>
            <div v-else>
              <input
                v-model="gardenNameDraft"
                type="text"
                maxlength="32"
                placeholder="e.g. Cam's Plot of Peace"
                class="gp-input text-sm w-full"
              />
              <div class="flex items-center justify-between mt-1.5">
                <span class="text-[10px] text-stone-400 tabular-nums">{{ gardenNameDraft.length }}/32</span>
                <div class="flex items-center gap-2">
                  <button @click="gardenNameEditing = false" class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
                  <button @click="saveGardenName" class="text-xs font-semibold text-garden-600 hover:text-garden-700 inline-flex items-center gap-1">
                    <Check :size="13" /> Save
                  </button>
                </div>
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

          <!-- Companion picker (self with profile). Mirrors the bloom picker's
               swatch interaction exactly: click to pick, click again to clear. -->
          <div v-if="isSelf && self.profile" class="mt-4">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Your companion</h5>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="(c, i) in companions"
                :key="c.name"
                @click="pickCompanion(i)"
                class="w-8 h-8 rounded-full bg-stone-50 border border-line transition-transform hover:scale-110 flex items-center justify-center"
                :class="avatarCompanion === i ? 'ring-2 ring-offset-1 ring-stone-400' : ''"
                :title="`${c.name}`"
                :aria-label="`${c.name} companion`"
              >
                <CompanionGlyph :kind="c.name" :size="16" />
              </button>
            </div>
            <p class="text-[10px] text-stone-400 mt-1.5">
              {{ avatarCompanion == null ? 'No companion perched on your bloom yet.' : 'Tap the icon again to remove your companion.' }}
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

          <!-- Pressed blooms: a permanent keepsake row for every language that
               has ever bloomed, independent of the one-time first-bloom toast. -->
          <div v-if="isSelf && flowers.length" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Pressed blooms</h5>
            <div class="flex flex-wrap gap-3">
              <div
                v-for="f in flowers"
                :key="f.id"
                class="flex flex-col items-center gap-1"
                :title="`${f.name}${f.bloomedAt ? ' — ' + fmtBloomedAt(f.bloomedAt) : ''}`"
              >
                <PressedFlower :language-id="f.id" :color="f.color" :name="f.name" :size="30" />
                <span class="text-[9px] text-stone-400">{{ f.bloomedAt ? fmtBloomedAt(f.bloomedAt) : f.name }}</span>
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

          <!-- Nightstand (self). A small cover strip of every book currently
               being read, replacing the single "currently reading" card. Each
               cover gets a language-coloured dot in the corner + a thin
               progress bar underneath so several in-progress books can sit
               side by side without visual noise. -->
          <div v-if="isSelf && nightstand.length" class="mt-5">
            <h5 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">On your nightstand</h5>
            <div class="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1">
              <div
                v-for="book in nightstand"
                :key="book.id"
                class="flex-shrink-0 w-16"
                :title="`${book.title}${book.author ? ' — ' + book.author : ''}`"
              >
                <div class="relative w-16 h-24 rounded-lg overflow-hidden bg-stone-200 ring-1 ring-line">
                  <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" />
                  <BookOpen v-else :size="18" class="text-stone-400 absolute inset-0 m-auto" />
                  <span
                    class="absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white"
                    :style="{ backgroundColor: bookColor(book.languageCode) }"
                    :aria-label="book.languageCode ? `${nameForCode(book.languageCode)} language` : ''"
                  ></span>
                </div>
                <div v-if="book.pct" class="mt-1 h-1 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :style="{ width: book.pct + '%', backgroundColor: bookColor(book.languageCode) }"
                  ></div>
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
import CompanionGlyph from './CompanionGlyph.vue'
import PressedFlower from './PressedFlower.vue'
import { useAuth } from '../composables/useAuth.js'
import { useBooks } from '../composables/useBooks.js'
import { BLOOMS, COMPANIONS } from '../lib/avatar.js'
import { languageHorizons, nightstandBooks, selfMilestones, plantedOnLabel, pressedFlowers } from '../lib/profileStats.js'
import { nameForCode } from '../lib/bookLanguages.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'self' }, // 'self' | 'friend'
  // Self inputs (null in friend mode). See App.vue's selfProfileInput.
  self: { type: Object, default: null },
  // Friend inputs (null in self mode). Base friend row + fetched bio/variant.
  friend: { type: Object, default: null },
})

const emit = defineEmits(['close', 'save-bio', 'save-garden-name', 'save-variant', 'save-companion', 'go-to-friends'])

const isSelf = computed(() => props.mode === 'self')
const blooms = BLOOMS
const companions = COMPANIONS

// Friend-mode reactivity mirrors the old FriendProfile: shared blooms and the
// friend's recent celebrations are read live from the shared social state.
const social = inject('social', null)
const { userId } = useAuth()

// Books power the "nightstand" cover strip. useBooks is a module singleton
// with its own cache, so touching it here lazy-loads at most once on first
// open and shares state with the Library — it never double-fetches.
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
const avatarCompanion = computed(() =>
  isSelf.value ? props.self?.profile?.avatar_companion ?? null : props.friend?.avatar_companion ?? null
)
const streak = computed(() => (isSelf.value ? props.self?.streak || 0 : props.friend?.current_streak || 0))
const plantedLabel = computed(() => (isSelf.value ? plantedOnLabel(props.self?.createdAt) : null))

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

// ── Garden name editing (self) ──────────────────────────────────────────────
const gardenName = computed(() => (props.self?.profile?.garden_name || '').trim())
const gardenNameEditing = ref(false)
const gardenNameDraft = ref('')
function startGardenNameEdit() {
  gardenNameDraft.value = gardenName.value
  gardenNameEditing.value = true
}
function saveGardenName() {
  // Empty string clears the field — App.vue writes null in that case so the
  // header falls back to the static "My Garden" copy.
  emit('save-garden-name', gardenNameDraft.value.trim())
  gardenNameEditing.value = false
}
// Reset the editor whenever the modal is reopened.
watch(() => props.visible, (v) => {
  if (!v) {
    bioEditing.value = false
    gardenNameEditing.value = false
  }
})

function pickVariant(i) {
  emit('save-variant', avatarVariant.value === i ? null : i)
}
function pickCompanion(i) {
  emit('save-companion', avatarCompanion.value === i ? null : i)
}

// ── Self derived views ──────────────────────────────────────────────────────
const horizons = computed(() =>
  isSelf.value ? languageHorizons(props.self?.entries || [], props.self?.languages || [], props.self?.nativeLanguage) : []
)
const nightstand = computed(() => (isSelf.value ? nightstandBooks(savedBooks.value) : []))
const flowers = computed(() =>
  isSelf.value ? pressedFlowers(props.self?.entries || [], props.self?.languages || []) : []
)
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
const friendGardenName = computed(() => (props.friend?.garden_name || '').trim())

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

// Map a book language code to the colour of the matching tracked Garten
// language, so the nightstand dots match the rest of the UI. Falls back to
// stone grey for books whose language isn't tracked (or whose code is
// unrecognised by the curated bookLanguages set). Matches on the canonical
// language name (the data key), not the display nickname.
function bookColor(languageCode) {
  if (!languageCode) return '#a8a29e'
  const name = nameForCode(languageCode)
  if (!name) return '#a8a29e'
  const lang = (props.self?.languages || []).find((l) => l.name === name)
  return lang?.color || '#a8a29e'
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
function fmtBloomedAt(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
function fmtHoursShort(hours) {
  const h = Number(hours) || 0
  if (h >= 100) return `${Math.round(h)}h`
  if (h >= 10) return `${h.toFixed(0)}h`
  return `${h.toFixed(1)}h`
}
</script>
