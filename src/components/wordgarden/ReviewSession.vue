<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="$emit('close')">
        <div class="relative gp-card shadow-hero w-full max-w-md p-5 sm:p-6 animate-grow-in">
          <!-- Header: progress + close -->
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <h2 class="gp-title text-base text-stone-900 inline-flex items-center gap-2">
              <Droplets :size="16" class="text-garden-600" />
              {{ isForcedRound ? 'Targeted round' : 'Watering round' }}
            </h2>
            <div class="flex items-center gap-3">
              <span v-if="current" class="text-xs text-stone-400 tabular-nums">{{ completed }} of {{ total }}</span>
              <button
                @click="$emit('close')"
                class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Close"
              >
                <X :size="16" />
              </button>
            </div>
          </div>

          <!-- Per-language filter chips — only when 2+ languages have due words.
               Mirrors WordList.vue's chip pattern; switching filters resets the
               active queue but preserves the cross-session total graded count. -->
          <div v-if="!isForcedRound && languagesDue.length > 1" class="flex flex-wrap items-center justify-center gap-1.5 pt-3">
            <button
              type="button"
              @click="applyFilter(null)"
              class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              :class="languageFilter === null ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
            >
              All
            </button>
            <button
              v-for="lang in languagesDue"
              :key="lang.id"
              type="button"
              @click="applyFilter(lang.id)"
              class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5"
              :class="languageFilter === lang.id ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
            >
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color || '#a8a29e' }"></span>
              {{ lang.name }}
              <span class="tabular-nums opacity-70">{{ lang.count }}</span>
            </button>
          </div>

          <!-- Active card -->
          <div v-if="current" class="py-8 text-center space-y-5">
            <div class="flex items-center justify-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: languageColor(current) || '#a8a29e' }"></span>
                {{ languageName(current) }}
              </span>
            </div>

            <div class="flex items-center justify-center gap-1.5 px-2">
              <p class="font-display text-2xl font-bold text-stone-900 leading-snug">{{ current.term }}</p>
              <button
                v-if="canSpeak(current)"
                type="button"
                @click="speak(current)"
                class="p-1.5 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-garden-50 transition-colors"
                title="Hear it"
                aria-label="Hear pronunciation"
              >
                <Volume2 :size="18" />
              </button>
            </div>

            <!-- Recall first, then reveal. -->
            <div v-if="!revealed">
              <button @click="revealed = true" class="gp-btn-primary px-6 py-2.5 text-sm">Show meaning</button>
            </div>
            <template v-else>
              <div class="space-y-1 animate-fade-up">
                <p v-if="current.meaning" class="text-lg text-stone-700">{{ current.meaning }}</p>
                <p v-else class="text-sm italic text-stone-400">No meaning yet — add one in your Word Garden to water this properly.</p>
                <p v-if="current.note" class="text-xs text-stone-400 italic px-4">{{ current.note }}</p>
              </div>

              <div class="grid grid-cols-3 gap-2 pt-1">
                <button
                  @click="grade('again')"
                  class="px-3 py-2.5 rounded-xl text-sm font-medium border border-line bg-white text-stone-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  Again
                  <span class="block text-[10px] font-normal text-stone-400">soon</span>
                </button>
                <button
                  @click="grade('good')"
                  class="px-3 py-2.5 rounded-xl text-sm font-medium border border-line bg-white text-stone-600 hover:border-garden-300 hover:text-garden-700 hover:bg-garden-50 transition-colors"
                >
                  Good
                  <span class="block text-[10px] font-normal text-stone-400">{{ intervalLabel(current, 'good') }}</span>
                </button>
                <button
                  @click="grade('easy')"
                  class="px-3 py-2.5 rounded-xl text-sm font-medium border border-garden-200 bg-garden-50 text-garden-700 hover:bg-garden-100 transition-colors"
                >
                  Easy
                  <span class="block text-[10px] font-normal text-garden-600/70">{{ intervalLabel(current, 'easy') }}</span>
                </button>
              </div>
            </template>
          </div>

          <!-- Selected language has no remaining due words (mid-session filter switch). -->
          <div v-else-if="filterBlocked" class="py-10 text-center text-stone-500 text-sm space-y-3">
            <p>No <span class="font-medium text-stone-700">{{ activeFilterName }}</span> words are due right now — they're all watered.</p>
            <button @click="applyFilter(null)" class="gp-btn-ghost px-4 py-1.5 text-sm">Review all</button>
          </div>

          <!-- Session opened with an empty due queue. -->
          <div v-else-if="!allDue.length" class="py-10 text-center text-stone-500 text-sm">
            Nothing is due right now — your words are all watered.
          </div>

          <!-- End-of-session summary -->
          <div v-else class="py-8 text-center space-y-4">
            <Sprout :size="28" class="mx-auto text-garden-600" />
            <p class="font-display text-xl font-bold text-stone-900">All watered for today.</p>
            <p class="text-sm text-stone-500">{{ summaryLine }}</p>
            <div class="flex flex-col sm:flex-row items-center gap-2 justify-center pt-1">
              <button
                v-if="weakWordIds.length"
                @click="$emit('review-weak', weakWordIds)"
                class="gp-btn-primary px-5 py-2 text-sm inline-flex items-center gap-1.5"
              >
                <RotateCcw :size="14" />
                Review the {{ weakWordIds.length }} again{{ weakWordIds.length === 1 ? '' : 's' }}
              </button>
              <button
                v-if="weakWordIds.length"
                @click="$emit('close')"
                class="gp-btn-ghost px-4 py-2 text-sm"
              >
                Back to the garden
              </button>
              <button
                v-else
                @click="$emit('close')"
                class="gp-btn-primary px-6 py-2 text-sm"
              >
                Back to the garden
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { X, Droplets, Sprout, RotateCcw, Volume2 } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { dueWords, sessionSummary, reviewWord, SRS_INTERVALS } from '../../lib/srs.js'
import { localDateStr } from '../../lib/date.js'
import { codeForName } from '../../lib/bookLanguages.js'

const props = defineProps({
  languages: { type: Array, default: () => [] },
  // When the parent passes a list of word ids, the session is scoped to
  // exactly those words (e.g. "review the ones you got wrong"). Otherwise
  // the session uses the full due-words set.
  forceIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'review-weak'])

const vocab = useVocab()

const isForcedRound = computed(() => Array.isArray(props.forceIds) && props.forceIds.length > 0)

// Snapshot the due queue at open — new words planted mid-session don't barge
// into an ongoing round. "Again" re-enqueues at the back (its dueDate stays
// today), so a shaky word repeats until it earns a Good. The user can narrow
// the round to one language via the chip bar; switching filters re-slices the
// snapshot to that language, preserving already-graded words as done so the
// user never re-waters the same word within a single round.
const allDue = ref([])
const languagesDue = ref([])
const languageFilter = ref(null)
const queue = ref([])
const total = ref(0)        // scope of the active filter (snapshot count)
const completed = ref(0)    // graded good/easy within the active filter
const totalCompleted = ref(0) // graded across the whole session
const revealed = ref(false)
const grades = ref([])
const gradedIds = new Set() // good/easy across session — closure-scoped, not reactive
// Words graded 'again' this session — surfaced on the end-of-session summary
// so the user can drill straight into another round on just those words.
const weakWordIds = ref([])

function buildInitialQueue() {
  if (isForcedRound.value) {
    // Parent told us exactly which words to re-water. Look them up in the
    // live store so post-grade refreshes resolve against the latest data.
    const ids = new Set(props.forceIds)
    return vocab.words.value.filter((w) => ids.has(w.id))
  }
  return dueWords(vocab.words.value, localDateStr(new Date()))
}

function buildLanguagesDue(queue) {
  const countsByLang = new Map()
  for (const w of queue) countsByLang.set(w.languageId, (countsByLang.get(w.languageId) || 0) + 1)
  const langById = new Map(props.languages.map((l) => [l.id, l]))
  return [...countsByLang.entries()]
    .map(([id, count]) => {
      const lang = langById.get(id)
      return { id, name: lang?.name || id, color: lang?.color || null, count }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function resetSession() {
  // Build the initial queue — the per-language chip bar and the active-card
  // picker work off this. Forced rounds skip the chip bar entirely (single
  // targeted review; the user picked a specific set).
  const initial = buildInitialQueue()
  allDue.value = initial
  languagesDue.value = isForcedRound.value ? [] : buildLanguagesDue(initial)
  languageFilter.value = null
  queue.value = initial.slice()
  total.value = queue.value.length
  completed.value = 0
  totalCompleted.value = 0
  revealed.value = false
  grades.value = []
  gradedIds.clear()
  weakWordIds.value = []
}

onMounted(resetSession)

// When the parent updates forceIds (the "review the agains" flow), reset
// the session to scope to the new word list without unmounting the modal.
watch(
  () => (Array.isArray(props.forceIds) ? props.forceIds.join(',') : ''),
  () => {
    if (!props.visible) return
    resetSession()
  }
)

function applyFilter(langId) {
  if (isForcedRound.value) return // forced rounds don't have a chip bar
  languageFilter.value = langId
  const base = langId ? allDue.value.filter((w) => w.languageId === langId) : allDue.value.slice()
  queue.value = base.filter((w) => !gradedIds.has(w.id))
  total.value = queue.value.length
  completed.value = 0
  revealed.value = false
}

// Re-resolve against the live store: after an "again", the queued reference
// is stale (updateWord swapped the object), and the interval labels should
// reflect the word's real, post-lapse stage.
const current = computed(() => {
  const queued = queue.value[0]
  if (!queued) return null
  return vocab.words.value.find((w) => w.id === queued.id) || queued
})
const filterBlocked = computed(() => !current.value && languageFilter.value !== null && !isForcedRound.value)
const activeFilterName = computed(() => languagesDue.value.find((l) => l.id === languageFilter.value)?.name || '')

const langById = computed(() => new Map(props.languages.map((l) => [l.id, l])))
function languageName(word) {
  return langById.value.get(word.languageId)?.name || word.languageId
}
function languageColor(word) {
  return langById.value.get(word.languageId)?.color || null
}

// ISO 639-1 code for the utterance's lang tag — same lookup path as the
// Wiktionary magnifier (WordList.vue's codeFor). Missing/untracked language
// still speaks, just with the browser's default voice.
function codeFor(word) {
  const lang = langById.value.get(word.languageId)
  return lang ? codeForName(lang.name) : null
}

// Browser-native TTS, zero backend. Voice quality varies wildly by
// language/platform though — a fallback voice reading a word in the wrong
// accent teaches worse pronunciation than showing nothing, so the icon only
// appears once we can confirm a real voice exists for that language.
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const availableVoices = ref([])

function loadVoices() {
  if (!speechSupported) return
  availableVoices.value = window.speechSynthesis.getVoices()
}

onMounted(() => {
  loadVoices()
  // Chrome loads voices asynchronously — the first call above often returns
  // an empty list, and this event is how it tells us they're ready.
  if (speechSupported) window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
})
onBeforeUnmount(() => {
  if (speechSupported) window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
})

function hasVoiceFor(code) {
  if (!code) return false
  return availableVoices.value.some((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase()))
}

function canSpeak(word) {
  return !!word && speechSupported && hasVoiceFor(codeFor(word))
}

function speak(word) {
  if (!canSpeak(word)) return
  const utterance = new SpeechSynthesisUtterance(word.term)
  utterance.lang = codeFor(word)
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

// "in 3d" — where this grade would send the word, so the buttons teach the
// schedule instead of feeling arbitrary.
function intervalLabel(word, gradeKey) {
  const days = SRS_INTERVALS[reviewWord(word, gradeKey).stage]
  if (days === 0) return 'today'
  if (days === 1) return 'in 1d'
  return `in ${days}d`
}

async function grade(g) {
  const word = current.value
  if (!word) return
  grades.value.push(g)
  revealed.value = false
  if (g === 'again') {
    // Keep the same in-memory object; its persisted dueDate stays today.
    queue.value = [...queue.value.slice(1), word]
    // Track the word id so the summary can offer a follow-up round.
    if (!weakWordIds.value.includes(word.id)) weakWordIds.value.push(word.id)
  } else {
    queue.value = queue.value.slice(1)
    completed.value += 1
    gradedIds.add(word.id)
    totalCompleted.value += 1
  }
  await vocab.gradeWord(word.id, g)
}

const summaryLine = computed(() => {
  const s = sessionSummary(grades.value)
  const words = totalCompleted.value === 1 ? 'word' : 'words'
  if (totalCompleted.value === 0) {
    return 'Nothing needed watering today — your words are all tended.'
  }
  if (s.again > 0) {
    return `${totalCompleted.value} ${words} watered — ${s.again} needed a second look, and that's how they grow.`
  }
  return `${totalCompleted.value} ${words} watered — every one moved closer to bloom.`
})
</script>