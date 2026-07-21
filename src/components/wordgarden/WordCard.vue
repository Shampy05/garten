<template>
  <div class="gp-card p-3">
    <!-- Display state -->
    <div v-if="!editing" class="flex items-start gap-3">
      <div
        class="pt-0.5 flex-shrink-0"
        :class="isLg && growth === 'flourish' ? 'ring-2 ring-amber-200/70 rounded-full' : ''"
      >
        <VocabStageGlyph :stage="growth" :color="languageColor" :size="glyphSize" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span :class="isLg ? 'text-base' : 'text-sm'" class="font-semibold text-stone-800">{{ word.term }}</span>
          <span v-if="word.meaning" :class="isLg ? 'text-base' : 'text-sm'" class="text-stone-500 min-w-0">{{ word.meaning }}</span>
          <button
            v-else
            @click="startEdit"
            class="text-sm italic text-stone-400 hover:text-garden-700 transition-colors"
            title="Add a meaning"
          >
            add a meaning
          </button>
          <span
            v-if="word.wordType"
            class="text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-full"
          >
            {{ WORD_TYPE_LABELS[word.wordType] || word.wordType }}
          </span>
          <span
            v-if="word.gender"
            class="text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-full"
          >
            {{ GENDER_LABELS[word.gender] || word.gender }}
          </span>
        </div>
        <p v-if="word.note" class="text-xs text-stone-400 mt-0.5 line-clamp-2">{{ word.note }}</p>
        <p v-if="sourceTitle" class="text-[11px] text-stone-400 mt-0.5 italic">from {{ sourceTitle }}</p>
        <div v-if="word.tags && word.tags.length" class="flex flex-wrap gap-1 mt-1">
          <button
            v-for="tag in word.tags"
            :key="tag"
            type="button"
            @click="$emit('filter-tag', tag)"
            class="text-[10px] font-medium text-garden-700 bg-garden-50 border border-garden-100 px-1.5 py-0.5 rounded-full hover:bg-garden-100 transition-colors"
          >
            {{ tag }}
          </button>
        </div>

        <!-- Album footer — only for the Mature deck's larger rows: a quiet
             "back in Nd" caption plus a hairline showing how far the word
             has traveled through its current interval. -->
        <div v-if="isLg && dueInDays !== null" class="mt-1.5 max-w-[10rem]">
          <span class="text-[11px] text-stone-400">back in {{ dueInDays }}d</span>
          <div class="w-full bg-stone-100 rounded-full h-1 overflow-hidden mt-1">
            <div
              class="h-1 rounded-full bg-garden-400 transition-all duration-700 ease-out"
              :style="{ width: (progressPct ?? 0) + '%' }"
            ></div>
          </div>
        </div>
      </div>
      <span
        v-if="due"
        class="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-garden-700 bg-garden-50 border border-garden-100 px-2 py-0.5 rounded-full"
      >
        Due
      </span>
      <div v-if="!hideActions" class="flex items-center flex-shrink-0">
        <button
          @click="startEdit"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil :size="13" />
        </button>
        <button
          @click="$emit('remove', word)"
          class="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove"
          aria-label="Remove"
        >
          <Trash2 :size="13" />
        </button>
      </div>
    </div>

    <!-- Inline edit state -->
    <div v-else class="space-y-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input v-model="draft.term" type="text" class="gp-input text-sm" placeholder="Word or phrase" />
        <div class="flex items-center gap-1">
          <input
            v-model="draft.meaning"
            type="text"
            class="gp-input text-sm flex-1 min-w-0"
            placeholder="Meaning"
          />
          <button
            type="button"
            @click="lookupOne"
            :disabled="lookupLoading"
            :title="lookupError ? lookupError : 'Look up meaning in Wiktionary'"
            class="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-garden-50 border border-transparent hover:border-garden-100 transition-colors disabled:opacity-50"
            :aria-label="`Look up meaning of ${draft.term}`"
          >
            <Loader2 v-if="lookupLoading" :size="13" class="animate-spin" />
            <Search v-else :size="13" />
          </button>
        </div>
      </div>

      <!-- Alternative definitions for the most recent lookup -->
      <div
        v-if="alternatives.length > 1"
        class="flex flex-wrap gap-1.5 -mt-1"
      >
        <button
          v-for="(alt, i) in alternatives"
          :key="`alt-${i}`"
          type="button"
          @click="draft.meaning = alt"
          :class="draft.meaning === alt ? 'bg-garden-600 text-white' : 'bg-white border border-line text-stone-600 hover:border-garden-200 hover:bg-garden-50'"
          class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
        >
          {{ alt }}
        </button>
      </div>

      <div v-if="!draft.meaning.trim()" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
        Adding a meaning helps the watering round stick.
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs font-medium text-stone-500">Part of speech</span>
        <button
          v-for="t in WORD_TYPES"
          :key="t"
          type="button"
          @click="draft.wordType = draft.wordType === t ? '' : t"
          class="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
          :class="draft.wordType === t ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
        >
          {{ WORD_TYPE_LABELS[t] }}
        </button>
      </div>

      <div v-if="availableGenders.length && isNounlike(draft.wordType)" class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs font-medium text-stone-500">Gender</span>
        <button
          v-for="g in availableGenders"
          :key="g"
          type="button"
          @click="draft.gender = draft.gender === g ? '' : g"
          class="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
          :class="draft.gender === g ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-garden-200'"
        >
          {{ GENDER_LABELS[g] }}
        </button>
      </div>

      <input v-model="draft.note" type="text" class="gp-input text-sm" placeholder="Context or example (optional)" />
      <div class="gp-input text-sm flex items-center focus-within:ring-2 focus-within:ring-garden-500/40 focus-within:border-garden-400">
        <TagInput v-model="draft.tags" />
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="saveEdit"
          :disabled="!draft.term.trim()"
          class="gp-btn-primary px-3 py-1.5 text-xs"
        >
          Save
        </button>
        <button @click="editing = false" class="gp-btn-ghost px-3 py-1.5 text-xs">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Pencil, Trash2, Search, Loader2 } from 'lucide-vue-next'
import { vocabGrowthStage, isDue, daysUntilDue, intervalProgress } from '../../lib/srs.js'
import { lookupWord } from '../../lib/dictLookup.js'
import { gendersForLanguage, GENDER_LABELS } from '../../lib/grammaticalGender.js'
import { WORD_TYPES, WORD_TYPE_LABELS, isNounlike } from '../../lib/wordType.js'
import VocabStageGlyph from './VocabStageGlyph.vue'
import TagInput from './TagInput.vue'

const props = defineProps({
  word: { type: Object, required: true },
  languageColor: { type: String, default: null },
  // Resolved by the parent against saved books; null when the source book is
  // gone (soft reference) or the word was planted by hand.
  sourceTitle: { type: String, default: null },
  // ISO 639-1 of the word's language — passed through to the Wiktionary
  // action-API fallback so it can narrow the page to the right section.
  // Optional; lookup degrades to JSON-only REST if absent.
  languageCode: { type: String, default: null },
  // Display name of the word's language — looked up against
  // grammaticalGender.js to decide which gender pills (if any) to show.
  languageName: { type: String, default: null },
  // When true, hide the inline edit/remove buttons. Used by the multi-
  // select mode in WordList — the parent owns the click/toggle instead.
  hideActions: { type: Boolean, default: false },
  // 'md' (default, every deck) | 'lg' (the Mature deck's "album" treatment:
  // a bigger glyph, a subtle ring on flourish words, and a quiet "back in
  // Nd" caption + interval-progress hairline under the term).
  size: { type: String, default: 'md' },
})

const emit = defineEmits(['update', 'remove', 'filter-tag'])

const growth = computed(() => vocabGrowthStage(props.word))
const due = computed(() => isDue(props.word))
const availableGenders = computed(() => gendersForLanguage(props.languageName))

const isLg = computed(() => props.size === 'lg')
const glyphSize = computed(() => (isLg.value ? 30 : 20))
const dueInDays = computed(() => (isLg.value ? daysUntilDue(props.word) : null))
const progressPct = computed(() => (isLg.value ? intervalProgress(props.word) : null))

const editing = ref(false)
const draft = ref({ term: '', meaning: '', note: '', gender: '', wordType: '', tags: [] })
const alternatives = ref([])
const lookupLoading = ref(false)
const lookupError = ref(null)

// A gender only makes sense for a noun — retagging mid-edit clears a stale
// selection the (now-hidden) pill row would otherwise silently carry into Save.
watch(() => draft.value.wordType, (t) => { if (!isNounlike(t)) draft.value.gender = '' })

function startEdit() {
  // Mined words can have a null meaning (they were planted seed-first);
  // normalize to '' so the input renders an empty field rather than the
  // literal "null" and so the .trim() in saveEdit never throws.
  draft.value = {
    term: props.word.term || '',
    meaning: props.word.meaning || '',
    note: props.word.note || '',
    gender: props.word.gender || '',
    wordType: props.word.wordType || '',
    tags: Array.isArray(props.word.tags) ? [...props.word.tags] : [],
  }
  // Reset the lookup state — the user may have changed the term.
  alternatives.value = []
  lookupError.value = null
  editing.value = true
}

// One-tap fill from Wiktionary: spinner while loading, first result fills
// the input, alternative definitions appear as clickable chips below.
// Failed lookups set a quiet error tooltip on the button — the user can
// always type the meaning by hand.
async function lookupOne() {
  if (lookupLoading.value) return
  const term = draft.value.term.trim()
  if (!term) return
  lookupLoading.value = true
  lookupError.value = null
  const res = await lookupWord(term, { languageCode: props.languageCode })
  lookupLoading.value = false
  if (res.ok) {
    alternatives.value = res.definitions
    draft.value.meaning = res.definitions[0]
  } else {
    alternatives.value = []
    lookupError.value = res.error || 'No result'
  }
}

function saveEdit() {
  emit('update', {
    id: props.word.id,
    updates: {
      term: draft.value.term.trim(),
      meaning: draft.value.meaning.trim() || null,
      note: draft.value.note.trim() || null,
      gender: draft.value.gender || null,
      wordType: draft.value.wordType || null,
      tags: draft.value.tags,
    },
  })
  editing.value = false
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
