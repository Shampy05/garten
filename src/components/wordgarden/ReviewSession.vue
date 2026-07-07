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
              Watering round
            </h2>
            <div class="flex items-center gap-3">
              <span v-if="!finished" class="text-xs text-stone-400 tabular-nums">{{ completed }} of {{ total }}</span>
              <button
                @click="$emit('close')"
                class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Close"
              >
                <X :size="16" />
              </button>
            </div>
          </div>

          <!-- Active card -->
          <div v-if="!finished && current" class="py-8 text-center space-y-5">
            <div class="flex items-center justify-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: languageColor(current) || '#a8a29e' }"></span>
                {{ languageName(current) }}
              </span>
            </div>

            <p class="font-display text-2xl font-bold text-stone-900 leading-snug px-2">{{ current.term }}</p>

            <!-- Recall first, then reveal. -->
            <div v-if="!revealed">
              <button @click="revealed = true" class="gp-btn-primary px-6 py-2.5 text-sm">Show meaning</button>
            </div>
            <template v-else>
              <div class="space-y-1 animate-fade-up">
                <p class="text-lg text-stone-700">{{ current.meaning }}</p>
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

          <!-- Nothing due (opened with an empty queue) -->
          <div v-else-if="!finished" class="py-10 text-center text-stone-500 text-sm">
            Nothing is due right now — your words are all watered.
          </div>

          <!-- End-of-session summary -->
          <div v-else class="py-8 text-center space-y-4">
            <Sprout :size="28" class="mx-auto text-garden-600" />
            <p class="font-display text-xl font-bold text-stone-900">All watered for today.</p>
            <p class="text-sm text-stone-500">{{ summaryLine }}</p>
            <button @click="$emit('close')" class="gp-btn-primary px-6 py-2 text-sm">Back to the garden</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { X, Droplets, Sprout } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { dueWords, sessionSummary, reviewWord, SRS_INTERVALS } from '../../lib/srs.js'
import { localDateStr } from '../../lib/date.js'

const props = defineProps({
  languages: { type: Array, default: () => [] },
})

defineEmits(['close'])

const vocab = useVocab()

// Snapshot the due queue at open — new words planted mid-session don't barge
// into an ongoing round. "Again" re-enqueues at the back (its dueDate stays
// today), so a shaky word repeats until it earns a Good.
const queue = ref([])
const total = ref(0)
const completed = ref(0)
const revealed = ref(false)
const grades = ref([])

onMounted(() => {
  queue.value = dueWords(vocab.words.value, localDateStr(new Date()))
  total.value = queue.value.length
})

// Re-resolve against the live store: after an "again", the queued reference
// is stale (updateWord swapped the object), and the interval labels should
// reflect the word's real, post-lapse stage.
const current = computed(() => {
  const queued = queue.value[0]
  if (!queued) return null
  return vocab.words.value.find((w) => w.id === queued.id) || queued
})
const finished = computed(() => total.value > 0 && queue.value.length === 0)

const langById = computed(() => new Map(props.languages.map((l) => [l.id, l])))
function languageName(word) {
  return langById.value.get(word.languageId)?.name || word.languageId
}
function languageColor(word) {
  return langById.value.get(word.languageId)?.color || null
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
  } else {
    queue.value = queue.value.slice(1)
    completed.value += 1
  }
  await vocab.gradeWord(word.id, g)
}

const summaryLine = computed(() => {
  const s = sessionSummary(grades.value)
  const words = total.value === 1 ? 'word' : 'words'
  if (s.again > 0) {
    return `${total.value} ${words} watered — ${s.again} needed a second look, and that's how they grow.`
  }
  return `${total.value} ${words} watered — every one moved closer to bloom.`
})
</script>
