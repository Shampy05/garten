<template>
  <div class="animate-fade-up">
    <!-- Header -->
    <div class="gp-card gp-pad mb-6 relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/80 to-transparent"></div>
      <!-- Identity: title + tagline. State and action live below it, in that
           order (mirrors the main dashboard's title → next-action → weekly
           goal → LogForm CTA stack) so what greets you is the garden's
           condition before it asks anything of you. -->
      <div class="relative flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-b from-garden-500 to-garden-600 text-white flex items-center justify-center flex-shrink-0 shadow-pill">
          <Leaf :size="22" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="font-display text-2xl font-bold text-stone-900 tracking-tight">Word Garden</h1>
          <p class="text-sm text-stone-500">
            Plant the words you meet — short reviews keep them growing.
            <span v-if="words.length" class="text-stone-400">{{ words.length }} {{ words.length === 1 ? 'word' : 'words' }} planted.</span>
          </p>
        </div>
      </div>

      <!-- State-of-the-garden strip: a segmented growth-distribution bar plus
           a due forecast and today's trace, once there's anything to show. -->
      <div v-if="words.length" class="relative mt-3 pt-3 border-t border-line">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-medium text-stone-500 uppercase tracking-wide">Your garden</span>
          <span class="text-xs text-stone-500 tabular-nums">{{ forecastLine }}</span>
        </div>
        <div class="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden flex ring-1 ring-inset ring-black/5">
          <div
            v-for="seg in stageSegments"
            :key="seg.stage"
            class="h-2.5 transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
            :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
            :title="`${seg.label} · ${seg.count}`"
            :aria-label="`${seg.label}: ${seg.count} words`"
          ></div>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          <span v-for="seg in visibleStageSegments" :key="seg.stage" class="inline-flex items-center gap-1 text-[10px] text-stone-500">
            <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: seg.color }"></span>
            {{ seg.label }} · {{ seg.count }}
          </span>
        </div>
        <p v-if="wateredTodayCount" class="text-xs text-stone-500 mt-2">
          <span class="font-medium text-stone-700">{{ wateredTodayCount }}</span>
          {{ wateredTodayCount === 1 ? 'word' : 'words' }} watered today.
        </p>
      </div>

      <!-- Rediscover nudge — only when there's nothing left due. A word
           that reaches the top of the ladder (30/90-day intervals) would
           otherwise only ever resurface on its exact due date; this offers
           one old, neglected word as an optional early peek instead. -->
      <p v-if="!dueCount && rediscoverWord" class="text-xs text-stone-500 mt-2 flex items-center gap-1.5 flex-wrap">
        <Sparkles :size="12" class="text-amber-500 flex-shrink-0" />
        Still remember <span class="font-medium text-stone-700">{{ rediscoverWord.term }}</span>? It's been a while.
        <button
          type="button"
          @click="startScopedReview([rediscoverWord.id])"
          class="text-garden-700 hover:text-garden-800 font-medium hover:underline flex-shrink-0"
        >
          Peek
        </button>
      </p>

      <!-- Actions row: Review is the primary verb (it's the loop that makes
           the garden grow), Scan is secondary. Sits below state/motivation,
           same ordering as the dashboard's LogForm CTA under its goal bar. -->
      <div v-if="words.length || languages.length" class="relative flex items-center gap-2 flex-wrap mt-4">
        <button
          v-if="dueCount > 0"
          @click="showReview = true"
          class="gp-btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0"
        >
          <Droplets :size="14" />
          Review · {{ dueCount }} due
        </button>
        <!-- A big due count is a wall; a small one is a held breath. Only
             offered once the queue is long enough that a smaller door is
             worth having — see QUICK_WATER_THRESHOLD below. -->
        <button
          v-if="quickWaterIds.length"
          @click="startScopedReview(quickWaterIds)"
          class="gp-btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0"
        >
          Quick water · {{ quickWaterIds.length }}
        </button>
        <span v-else-if="words.length" class="text-xs text-stone-400 flex-shrink-0">
          All watered<span class="hidden sm:inline"> — nothing due today.</span>
        </span>
        <button
          v-if="languages.length"
          @click="showScan = true"
          class="gp-btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0"
        >
          <Camera :size="14" />
          Scan a page
        </button>
      </div>
    </div>

    <div class="space-y-5">
      <!-- No tracked languages: the garden needs somewhere to plant. -->
      <div v-if="!languages.length" class="gp-card gp-pad text-center text-stone-500 py-10">
        <Leaf class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p class="text-sm">Add a language to your garden first — words need a bed to grow in.</p>
      </div>

      <template v-else>
        <!-- Plant-a-word rests as a button, same progressive-disclosure
             pattern as the main dashboard's LogForm — capture is the rarest
             in-tab action (most words arrive via the Library or Scan a
             page), so it shouldn't be the first thing on the page. Opens
             automatically on a brand-new garden so first-run still onboards
             straight into the form. -->
        <button
          v-if="!showCapture"
          type="button"
          @click="showCapture = true"
          class="gp-btn-ghost w-full flex items-center justify-center gap-2 py-3 text-sm"
        >
          <Sprout :size="15" />
          Plant a word
        </button>
        <WordCaptureForm
          v-else
          :languages="languages"
          :entries="entries"
          :language-filter="languageFilter"
          @update:language-filter="languageFilter = $event"
        />

        <!-- The Language select above and the list below share the same filter.
             Show a one-line hint near the form so the link is obvious. -->
        <p v-if="languageFilter && filterName" class="text-[11px] text-stone-500 -mt-1">
          Showing <span class="font-medium text-stone-700">{{ filterName }}</span> words.
          <button
            type="button"
            @click="languageFilter = null"
            class="ml-1 underline-offset-2 hover:underline"
          >
            Show all
          </button>
        </p>

        <div v-if="!loaded && !loadError" class="text-center py-10 text-stone-400">
          <Leaf class="w-10 h-10 mx-auto mb-3 opacity-50 animate-breathe" />
          <p class="text-sm">Gathering your words…</p>
        </div>
        <div v-else-if="loadError" class="gp-card gp-pad text-center text-stone-500 max-w-sm mx-auto">
          <p class="text-sm mb-3">We couldn't load your word garden.</p>
          <button @click="retryLoad" class="gp-btn-primary px-5 py-2 text-sm">Try again</button>
        </div>
        <div v-else-if="!words.length" class="text-center py-8 text-stone-400">
          <p class="text-sm text-stone-500">Nothing planted yet.</p>
          <p class="text-xs mt-1">Plant the first word you meet today — it takes ten seconds.</p>
        </div>
        <WordList
          v-else
          :words="words"
          :languages="languages"
          :source-titles="sourceTitles"
          :language-filter="languageFilter"
          :advanced-ids="justAdvancedIds"
          @update:language-filter="languageFilter = $event"
          @update="onUpdate"
          @remove="confirmRemove"
          @bulk-remove="onBulkRemove"
          @review-tag="startScopedReview"
        />
      </template>
    </div>

    <ReviewSession
      v-if="showReview"
      :languages="languages"
      :force-ids="forceReviewIds"
      @close="onReviewClose"
      @review-weak="onReviewWeak"
      @keep-going="onReviewWeak"
    />

    <ScanPageModal
      :visible="showScan"
      :languages="languages"
      :entries="entries"
      @close="showScan = false"
    />

    <ConfirmDialog
      :visible="showRemoveConfirm"
      title="Remove word?"
      :message="`This pulls “${removeTarget?.term ?? ''}” out of your garden, along with its review history. This cannot be undone.`"
      confirm-label="Remove"
      danger
      @confirm="executeRemove"
      @cancel="cancelRemove"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Leaf, Droplets, Sparkles, Camera, Sprout } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { rediscoverPick, dueWords } from '../../lib/srs.js'
import { stageDistribution, dueForecast, wateredToday } from '../../lib/vocabStats.js'
import { useBooks } from '../../composables/useBooks.js'
import { useToast } from '../../composables/useToast.js'
import WordCaptureForm from './WordCaptureForm.vue'
import WordList from './WordList.vue'
import ReviewSession from './ReviewSession.vue'
import ScanPageModal from './ScanPageModal.vue'
import ConfirmDialog from '../ConfirmDialog.vue'

const props = defineProps({
  // Tracked Garten languages + study entries, passed by App.vue from the
  // useStorage data it already holds — no new reads.
  languages: { type: Array, default: () => [] },
  entries: { type: Array, default: () => [] },
})

const { words, loaded, loadError, dueCount, retryLoad, updateWord, removeWord, removeWords } = useVocab()

// Resolve capture-from-reading source books to titles (soft references — a
// removed book simply resolves to nothing). useBooks is the shared module
// singleton, already loaded once per session.
const { savedBooks } = useBooks()
const sourceTitles = computed(() => {
  const map = {}
  for (const b of savedBooks.value) map[b.id] = b.title
  return map
})

// Plant-a-word form visibility — rests collapsed, same as LogForm on the
// main dashboard. Opens by default once the garden is confirmed empty (gated
// on `loaded` so it doesn't flash open during the brief window before data
// arrives) so first-run onboarding still lands straight in the form.
const showCapture = ref(false)
watch(
  loaded,
  (isLoaded) => {
    if (isLoaded && words.value.length === 0) showCapture.value = true
  },
  { immediate: true }
)

// State-of-the-garden strip — pure computeds over the in-memory word list,
// see src/lib/vocabStats.js.
const stageSegments = computed(() => stageDistribution(words.value))
const visibleStageSegments = computed(() => stageSegments.value.filter((s) => s.count > 0))
const wateredTodayCount = computed(() => wateredToday(words.value))
const forecastLine = computed(() => {
  const { dueToday, dueTomorrow, dueThisWeek } = dueForecast(words.value)
  const parts = [`${dueToday} today`]
  if (dueTomorrow) parts.push(`${dueTomorrow} tomorrow`)
  if (dueThisWeek) parts.push(`${dueThisWeek} more this week`)
  return parts.join(' · ')
})

// Quick water — a small-commitment entry point next to the main Review CTA,
// only once the due queue is long enough that a smaller door is worth
// having ("Review · 34 due" is a wall; 5 words is a held breath). The most
// overdue words first, same ordering dueWords() already uses for a full
// round.
const QUICK_WATER_THRESHOLD = 10
const QUICK_WATER_SIZE = 5
const quickWaterIds = computed(() => {
  if (dueCount.value <= QUICK_WATER_THRESHOLD) return []
  return dueWords(words.value).slice(0, QUICK_WATER_SIZE).map((w) => w.id)
})

// Post-review return moment — words that crossed a growth-stage glyph this
// visit get a one-time grow-in flash where they resurface in the list
// (WordList → WordRow). Cleared shortly after so an unrelated later
// re-render (e.g. editing a word) never replays it.
const justAdvancedIds = ref(new Set())
let advanceFlashTimer = null
onBeforeUnmount(() => clearTimeout(advanceFlashTimer))

const showReview = ref(false)
const showScan = ref(false)
// When non-empty, the open ReviewSession is scoped to these specific word
// ids (a "review the agains" follow-up from the previous round's summary,
// or a themed "review this tag" round from WordList). Empty = the regular
// "all due words" round.
const forceReviewIds = ref([])

// A themed review — WordList's "Review N in {tag}" button hands us the
// already-due, already-scoped word ids directly (language + tag filter
// both baked in), so this is just a thin trigger, same shape as onReviewWeak.
function startScopedReview(wordIds) {
  if (!Array.isArray(wordIds) || !wordIds.length) return
  forceReviewIds.value = wordIds
  showReview.value = true
}

// Only surfaced once there's nothing left due — the regular queue always
// takes priority, and this is meant to fill the "all watered" dead space,
// not compete with it. A forced round works fine for a not-due word:
// ReviewSession's forced-round queue just filters by id, no isDue gate.
const rediscoverWord = computed(() => (dueCount.value ? null : rediscoverPick(words.value)))

const toast = useToast()

function onReviewClose(payload) {
  showReview.value = false
  forceReviewIds.value = []
  const ids = payload?.advancedIds
  if (Array.isArray(ids) && ids.length) {
    justAdvancedIds.value = new Set(ids)
    clearTimeout(advanceFlashTimer)
    advanceFlashTimer = setTimeout(() => {
      justAdvancedIds.value = new Set()
    }, 2000)
  }
}

// End-of-round summary offered a "review the agains" follow-up. Stay in
// the modal and re-scope the session to just the words the user got wrong.
function onReviewWeak(wordIds) {
  if (!Array.isArray(wordIds) || !wordIds.length) {
    showReview.value = false
    forceReviewIds.value = []
    return
  }
  forceReviewIds.value = wordIds
}

// Active language filter shared by the Plant-a-word form and the word list —
// the form's Language select and the list's chip bar are two views onto the
// same state, so picking one updates the other.
const languageFilter = ref(null)
const filterName = computed(() => {
  if (!languageFilter.value) return ''
  return props.languages.find((l) => l.id === languageFilter.value)?.name || languageFilter.value
})

// Renaming a word to match another one in the same language is rejected by
// useVocab.updateWord() (same guard as planting a fresh duplicate) — the
// edit form already closed optimistically, so surface why nothing changed.
async function onUpdate({ id, updates }) {
  const result = await updateWord(id, updates)
  if (result?.duplicate) {
    toast.error(`"${result.existing.term}" is already growing in your garden.`)
  }
}

// Remove flow — same ConfirmDialog contract as the Library.
const removeTarget = ref(null)
const showRemoveConfirm = ref(false)
function confirmRemove(word) {
  removeTarget.value = word
  showRemoveConfirm.value = true
}
function cancelRemove() {
  removeTarget.value = null
  showRemoveConfirm.value = false
}
async function executeRemove() {
  if (removeTarget.value) await removeWord(removeTarget.value.id)
  removeTarget.value = null
  showRemoveConfirm.value = false
}

// Multi-select bulk remove: takes an array of word ids, fires one
// DELETE in (ids) via useVocab.removeWords, and toasts the result.
// useVocab owns the optimistic state + rollback on error.
async function onBulkRemove(ids) {
  if (!Array.isArray(ids) || !ids.length) return
  const n = ids.length
  const result = await removeWords(ids)
  if (result?.error) {
    // useVocab already toasted the error; nothing to do here.
    return
  }
  toast.show(`Removed ${n} ${n === 1 ? 'word' : 'words'}.`, 'success', 3500)
}
</script>
