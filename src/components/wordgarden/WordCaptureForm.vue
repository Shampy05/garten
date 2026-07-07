<template>
  <form class="gp-card gp-pad space-y-3" @submit.prevent="submit">
    <div class="flex items-center gap-2">
      <h3 class="gp-title text-sm uppercase tracking-wider text-stone-500">Plant a word</h3>
      <span class="text-[11px] text-stone-400">New words start as seeds, due for review today.</span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-stone-500 mb-1">Word or phrase</label>
        <input
          ref="termInput"
          v-model="term"
          type="text"
          class="gp-input"
          placeholder="e.g. die Gelassenheit"
          maxlength="200"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-stone-500 mb-1">Meaning</label>
        <input
          v-model="meaning"
          type="text"
          class="gp-input"
          placeholder="e.g. calmness, composure"
          maxlength="500"
        />
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div class="sm:w-44 flex-shrink-0">
        <label class="block text-xs font-medium text-stone-500 mb-1">Language</label>
        <select v-model="languageId" class="gp-input">
          <option v-for="lang in languages" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
        </select>
      </div>

      <div class="flex-1">
        <button
          v-if="!showNote"
          type="button"
          @click="showNote = true"
          class="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          + add context
        </button>
        <template v-else>
          <label class="block text-xs font-medium text-stone-500 mb-1">Context or example <span class="font-normal text-stone-400">(optional)</span></label>
          <input v-model="note" type="text" class="gp-input" placeholder="the sentence where you met it" />
        </template>
      </div>

      <button
        type="submit"
        :disabled="!canSubmit || submitting"
        class="gp-btn-primary px-5 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0"
      >
        <Sprout :size="14" />
        Plant
      </button>
    </div>

    <p v-if="duplicateNote" class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
      {{ duplicateNote }}
    </p>
  </form>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Sprout } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'

const props = defineProps({
  // Tracked Garten languages ({ id, name }).
  languages: { type: Array, default: () => [] },
  // Study entries — used only to default the language to the most recently
  // studied one.
  entries: { type: Array, default: () => [] },
  // Optional presets for capture-from-reading: lock in a language and carry
  // the source book.
  presetLanguageId: { type: String, default: null },
  sourceBookId: { type: String, default: null },
})

const emit = defineEmits(['added'])

const vocab = useVocab()

const term = ref('')
const meaning = ref('')
const note = ref('')
const showNote = ref(false)
const languageId = ref(null)
const duplicateNote = ref('')
const submitting = ref(false)
const termInput = ref(null)

const canSubmit = computed(() => term.value.trim() && meaning.value.trim() && languageId.value)

// Default language: the preset (capture-from-reading), else the single
// tracked language, else the most recently studied one.
function defaultLanguageId() {
  if (props.presetLanguageId) return props.presetLanguageId
  if (props.languages.length === 1) return props.languages[0].id
  let latest = null
  for (const e of props.entries) {
    if (!latest || e.date > latest.date) latest = e
  }
  if (latest && props.languages.find((l) => l.id === latest.languageId)) return latest.languageId
  return props.languages[0]?.id ?? null
}

watch(
  () => [props.languages.length, props.presetLanguageId],
  () => {
    if (!languageId.value || !props.languages.find((l) => l.id === languageId.value)) {
      languageId.value = defaultLanguageId()
    }
  },
  { immediate: true }
)

async function submit() {
  if (!canSubmit.value || submitting.value) return
  duplicateNote.value = ''
  submitting.value = true
  try {
    const result = await vocab.addWord({
      term: term.value,
      meaning: meaning.value,
      note: note.value,
      languageId: languageId.value,
      sourceBookId: props.sourceBookId,
    })
    if (result?.duplicate) {
      duplicateNote.value = `“${result.existing.term}” is already growing in your garden.`
      return
    }
    if (result?.word) {
      term.value = ''
      meaning.value = ''
      note.value = ''
      emit('added', result.word)
      termInput.value?.focus()
    }
  } finally {
    submitting.value = false
  }
}
</script>
