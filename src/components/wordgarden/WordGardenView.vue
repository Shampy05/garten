<template>
  <div class="animate-fade-up">
    <!-- Header -->
    <div class="gp-card gp-pad mb-6 relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/80 to-transparent"></div>
      <div class="relative flex items-center gap-3 flex-wrap">
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
        <button
          v-if="dueCount > 0"
          @click="showReview = true"
          class="gp-btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0"
        >
          <Droplets :size="14" />
          Review · {{ dueCount }} due
        </button>
        <span v-else-if="words.length" class="text-xs text-stone-400 flex-shrink-0">
          All watered — nothing due today.
        </span>
      </div>
    </div>

    <div class="space-y-5">
      <!-- No tracked languages: the garden needs somewhere to plant. -->
      <div v-if="!languages.length" class="gp-card gp-pad text-center text-stone-500 py-10">
        <Leaf class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p class="text-sm">Add a language to your garden first — words need a bed to grow in.</p>
      </div>

      <template v-else>
        <WordCaptureForm :languages="languages" :entries="entries" />

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
          @update="onUpdate"
          @remove="confirmRemove"
        />
      </template>
    </div>

    <ReviewSession v-if="showReview" :languages="languages" @close="showReview = false" />

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
import { Leaf, Droplets } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { useBooks } from '../../composables/useBooks.js'
import WordCaptureForm from './WordCaptureForm.vue'
import WordList from './WordList.vue'
import ReviewSession from './ReviewSession.vue'
import ConfirmDialog from '../ConfirmDialog.vue'

defineProps({
  // Tracked Garten languages + study entries, passed by App.vue from the
  // useStorage data it already holds — no new reads.
  languages: { type: Array, default: () => [] },
  entries: { type: Array, default: () => [] },
})

const { words, loaded, loadError, dueCount, retryLoad, updateWord, removeWord } = useVocab()

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

function onUpdate({ id, updates }) {
  updateWord(id, updates)
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
</script>
