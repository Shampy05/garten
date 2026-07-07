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
        <div class="flex items-center gap-1">
          <input
            v-model="meaning"
            type="text"
            class="gp-input flex-1 min-w-0"
            placeholder="e.g. calmness, composure"
            maxlength="500"
          />
          <button
            type="button"
            @click="lookupOne"
            :disabled="lookupLoading || !term.trim()"
            :title="lookupError ? lookupError : 'Look up meaning in Wiktionary'"
            class="flex-shrink-0 p-2 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-garden-50 border border-transparent hover:border-garden-100 transition-colors disabled:opacity-50"
            :aria-label="`Look up meaning of ${term}`"
          >
            <Loader2 v-if="lookupLoading" :size="14" class="animate-spin" />
            <Search v-else :size="14" />
          </button>
        </div>
        <div
          v-if="alternatives.length > 1"
          class="flex flex-wrap gap-1.5 mt-1.5"
        >
          <button
            v-for="(alt, i) in alternatives"
            :key="`alt-${i}`"
            type="button"
            @click="meaning = alt"
            :class="meaning === alt ? 'bg-garden-600 text-white' : 'bg-white border border-line text-stone-600 hover:border-garden-200 hover:bg-garden-50'"
            class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
          >
            {{ alt }}
          </button>
        </div>
      </div>
    </div>

    <!-- Part of speech — universal (unlike gender, every language has
         nouns/verbs/adjectives), so always offered. Also gates the gender
         row below: gender only means something for a noun. -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <span class="text-xs font-medium text-stone-500">Part of speech</span>
      <button
        v-for="t in WORD_TYPES"
        :key="t"
        type="button"
        @click="wordType = wordType === t ? '' : t"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="wordType === t ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        {{ WORD_TYPE_LABELS[t] }}
      </button>
    </div>

    <!-- Grammatical gender — only for languages that actually have one, and
         only the genders that language has (e.g. no "Neuter" pill for
         French), and only when the word is a noun (or untagged). Purely
         optional: most planted words are ungendered or the gardener just
         doesn't know it yet. -->
    <div v-if="availableGenders.length && isNounlike(wordType)" class="flex items-center gap-1.5 flex-wrap">
      <span class="text-xs font-medium text-stone-500">Gender</span>
      <button
        v-for="g in availableGenders"
        :key="g"
        type="button"
        @click="gender = gender === g ? '' : g"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="gender === g ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-garden-200'"
      >
        {{ GENDER_LABELS[g] }}
      </button>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div class="sm:w-44 flex-shrink-0">
        <label class="block text-xs font-medium text-stone-500 mb-1">Language</label>
        <select v-model="languageId" class="gp-input" @change="onLanguageChange">
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
          + add context & tags
        </button>
        <template v-else>
          <label class="block text-xs font-medium text-stone-500 mb-1">Context or example <span class="font-normal text-stone-400">(optional)</span></label>
          <input v-model="note" type="text" class="gp-input" placeholder="the sentence where you met it" />
          <label class="block text-xs font-medium text-stone-500 mb-1 mt-2">Tags <span class="font-normal text-stone-400">(optional — group into themed sets like "kitchen")</span></label>
          <div class="gp-input flex items-center focus-within:ring-2 focus-within:ring-garden-500/40 focus-within:border-garden-400">
            <TagInput v-model="tags" />
          </div>
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
import { Sprout, Search, Loader2 } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { lookupWord } from '../../lib/dictLookup.js'
import { codeForName } from '../../lib/bookLanguages.js'
import { gendersForLanguage, GENDER_LABELS } from '../../lib/grammaticalGender.js'
import { WORD_TYPES, WORD_TYPE_LABELS, isNounlike } from '../../lib/wordType.js'
import TagInput from './TagInput.vue'

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
  // v-model: the active language filter the parent owns. The form's select
  // becomes the user-facing way to change the list filter as well.
  languageFilter: { type: String, default: null },
})

const emit = defineEmits(['added', 'update:languageFilter'])

const vocab = useVocab()

const term = ref('')
const meaning = ref('')
const note = ref('')
const gender = ref('')
const wordType = ref('')
const tags = ref([])
const showNote = ref(false)
const languageId = ref(null)
const duplicateNote = ref('')
const submitting = ref(false)
const termInput = ref(null)
const alternatives = ref([])
const lookupLoading = ref(false)
const lookupError = ref(null)

const canSubmit = computed(() => term.value.trim() && meaning.value.trim() && languageId.value)

const selectedLanguageName = computed(() => props.languages.find((l) => l.id === languageId.value)?.name || null)
const availableGenders = computed(() => gendersForLanguage(selectedLanguageName.value))

// A gender picked for one language rarely means anything for another (and
// "Common"/"Neuter" for Danish would be a stray, meaningless pill left over
// for a German word) — clear it whenever the language changes.
watch(languageId, () => { gender.value = '' })

// Same idea: a gender only makes sense for a noun, so retagging a word as a
// verb/adjective/etc. clears a stale selection the (now-hidden) pill row
// would otherwise silently carry into the next Plant.
watch(wordType, (t) => { if (!isNounlike(t)) gender.value = '' })

// Default language: the parent's filter, the preset (capture-from-reading),
// else the single tracked language, else the most recently studied one.
function defaultLanguageId() {
  if (props.languageFilter && props.languages.find((l) => l.id === props.languageFilter)) {
    return props.languageFilter
  }
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
  () => [props.languages.length, props.presetLanguageId, props.languageFilter],
  () => {
    // If the parent pushed an explicit filter, mirror it onto the form
    // (round-trip with the chip bar). Otherwise, just guard against a stale
    // or missing selection (e.g. the active language was removed).
    if (props.languageFilter && props.languages.find((l) => l.id === props.languageFilter)) {
      languageId.value = props.languageFilter
      return
    }
    if (!languageId.value || !props.languages.find((l) => l.id === languageId.value)) {
      languageId.value = defaultLanguageId()
    }
  },
  { immediate: true }
)

function onLanguageChange() {
  emit('update:languageFilter', languageId.value)
}

// Reset lookup alternatives when the user types a new term — the old chips
// would otherwise stick around and confuse the next click.
watch(term, () => {
  alternatives.value = []
  lookupError.value = null
})

// Wiktionary lookup. Same UX as MineWordsModal and WordCard's edit form:
// spinner while loading, first result fills Meaning, alternative chips
// below if multiple senses came back, quiet error tooltip on failure.
const selectedLanguageCode = computed(() => {
  const lang = props.languages.find((l) => l.id === languageId.value)
  return lang ? codeForName(lang.name) : null
})

async function lookupOne() {
  if (lookupLoading.value) return
  const t = term.value.trim()
  if (!t) return
  lookupLoading.value = true
  lookupError.value = null
  const res = await lookupWord(t, { languageCode: selectedLanguageCode.value })
  lookupLoading.value = false
  if (res.ok) {
    alternatives.value = res.definitions
    meaning.value = res.definitions[0]
  } else {
    alternatives.value = []
    lookupError.value = res.error || 'No result'
  }
}

// Mirror every change to languageId (init, user pick, parent push) up to the
// parent's filter so the form and the list stay locked together.
watch(languageId, (id) => {
  if (id != null) emit('update:languageFilter', id)
})

async function submit() {
  if (!canSubmit.value || submitting.value) return
  duplicateNote.value = ''
  submitting.value = true
  try {
    const result = await vocab.addWord({
      term: term.value,
      meaning: meaning.value,
      note: note.value,
      gender: gender.value || null,
      wordType: wordType.value || null,
      tags: tags.value,
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
      gender.value = ''
      wordType.value = ''
      tags.value = []
      emit('added', result.word)
      termInput.value?.focus()
    }
  } finally {
    submitting.value = false
  }
}
</script>
