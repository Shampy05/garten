<template>
  <div class="animate-fade-up">
    <!-- Header -->
    <div class="gp-card gp-pad mb-6 relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/80 to-transparent"></div>
      <div class="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="flex items-center gap-3">
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
        <button
          v-if="dueCount > 0"
          @click="showReview = true"
          class="gp-btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0 sm:ml-auto"
        >
          <Droplets :size="14" />
          Review · {{ dueCount }} due
        </button>
        <span v-else-if="words.length" class="text-xs text-stone-400 flex-shrink-0 sm:ml-auto">
          All watered<span class="hidden sm:inline"> — nothing due today.</span>
        </span>
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
    </div>

    <div class="space-y-5">
      <!-- No tracked languages: the garden needs somewhere to plant. -->
      <div v-if="!languages.length" class="gp-card gp-pad text-center text-stone-500 py-10">
        <Leaf class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p class="text-sm">Add a language to your garden first — words need a bed to grow in.</p>
      </div>

      <template v-else>
        <WordCaptureForm
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
import { ref, computed } from 'vue'
import { Leaf, Droplets, Sparkles } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { rediscoverPick } from '../../lib/srs.js'
import { useBooks } from '../../composables/useBooks.js'
import { useToast } from '../../composables/useToast.js'
import WordCaptureForm from './WordCaptureForm.vue'
import WordList from './WordList.vue'
import ReviewSession from './ReviewSession.vue'
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

const showReview = ref(false)
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

function onReviewClose() {
  showReview.value = false
  forceReviewIds.value = []
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
