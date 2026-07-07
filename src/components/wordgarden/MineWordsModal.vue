<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="$emit('close')">
        <div class="relative gp-card shadow-hero w-full max-w-lg p-5 sm:p-6 animate-grow-in">
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <h2 class="gp-title text-base text-stone-900 inline-flex items-center gap-2">
              <Sparkles v-if="!defineStep" :size="16" class="text-garden-600" />
              <BookMarked v-else :size="16" class="text-garden-600" />
              {{ defineStep ? 'Add meanings' : 'Mine words' }}
            </h2>
            <button
              @click="$emit('close')"
              class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- Source line -->
          <div class="flex items-center gap-2 mt-3 text-xs text-stone-500">
            <span>From</span>
            <span class="font-medium text-stone-700 truncate">{{ book?.title || 'a book' }}</span>
            <span v-if="languageMeta" class="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full flex-shrink-0">
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: languageMeta.color || '#a8a29e' }"></span>
              {{ languageMeta.name }}
            </span>
          </div>

          <!-- ─── Step 1: Pick words from the passage ──────────────────────── -->
          <template v-if="!defineStep">
            <!-- Language-not-tracked notice -->
            <p v-if="!targetLanguageId" class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span class="font-medium">{{ languageCodeLabel }}</span> isn't in your garden yet — add it as a tracked language first to plant words here.
            </p>

            <!-- Passage input — prefilled with the book's description; the user
                 can also paste their own paragraph from the page they just read. -->
            <div v-else class="mt-3">
              <label class="block text-xs font-medium text-stone-500 mb-1">Passage</label>
              <textarea
                v-model="passage"
                class="gp-input min-h-[120px] resize-y font-mono text-sm leading-relaxed"
                placeholder="Paste a paragraph from the page you just read — or edit the book's description below."
              ></textarea>
              <p class="text-[11px] text-stone-400 mt-1">Candidates appear as you type. Select what's worth growing.</p>
            </div>

            <!-- Candidates -->
            <div v-if="targetLanguageId && passage.trim()" class="mt-4 space-y-3">
              <div v-if="candidates.length || skipped.planted.length">
                <div v-if="candidates.length" class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  {{ candidates.length }} new {{ candidates.length === 1 ? 'candidate' : 'candidates' }}
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="tok in candidates"
                    :key="tok"
                    type="button"
                    @click="toggle(tok)"
                    class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1"
                    :class="selected.has(tok)
                      ? 'bg-garden-600 text-white shadow-pill'
                      : 'bg-white border border-line text-stone-700 hover:border-garden-200 hover:bg-garden-50'"
                  >
                    <Check v-if="selected.has(tok)" :size="11" />
                    {{ tok }}
                  </button>
                </div>

                <button
                  type="button"
                  @click="selectAll"
                  class="mt-2 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {{ selected.size === candidates.length ? 'Clear all' : `Select all (${candidates.length})` }}
                </button>
              </div>

              <div v-else class="text-sm text-stone-500 italic px-1">
                No new words found — paste a longer passage or one with less common vocabulary.
              </div>

              <div v-if="skipped.planted.length" class="pt-2 border-t border-line">
                <div class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  Already planted · {{ skipped.planted.length }}
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tok in skipped.planted"
                    :key="`p-${tok}`"
                    class="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-400 inline-flex items-center gap-1"
                  >
                    <Check :size="11" />
                    {{ tok }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Step-1 footer -->
            <div class="flex items-center gap-2 pt-4 mt-4 border-t border-line">
              <span class="text-xs text-stone-400 flex-1">
                <span v-if="selected.size">{{ selected.size }} selected</span>
                <span v-else>Tap chips to select.</span>
              </span>
              <button @click="$emit('close')" class="gp-btn-ghost px-4 py-2 text-sm">Done</button>
              <button
                @click="plantSelected"
                :disabled="!selected.size || !targetLanguageId || planting"
                class="gp-btn-primary px-5 py-2 text-sm inline-flex items-center gap-1.5"
              >
                <Sprout :size="14" />
                Plant {{ selected.size || '' }}
              </button>
            </div>
          </template>

          <!-- ─── Step 2: Define meanings (right away) ─────────────────────── -->
          <template v-else>
            <p class="mt-3 text-xs text-stone-500">
              <span class="font-medium text-stone-700">{{ plantedTerms.length }} new {{ plantedTerms.length === 1 ? 'word' : 'words' }}</span> planted.
              Add meanings now so they're ready for the watering round —
              skip and you can fill them in from the Word Garden later.
            </p>

            <div class="mt-3 space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              <div
                v-for="row in plantedTerms"
                :key="row.id"
                class="flex items-center gap-2"
              >
                <span class="flex-shrink-0 min-w-[6rem] max-w-[8rem] text-sm font-medium text-stone-800 truncate" :title="row.term">
                  {{ row.term }}
                </span>
                <input
                  v-model="row.meaning"
                  type="text"
                  class="gp-input flex-1 min-w-0 text-sm"
                  placeholder="meaning"
                  @keydown.enter.prevent="saveMeanings"
                />
                <button
                  type="button"
                  @click="lookupOne(row)"
                  :disabled="row.loading"
                  :title="row.definitionError ? row.definitionError : 'Look up meaning in Wiktionary'"
                  class="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-garden-50 border border-transparent hover:border-garden-100 transition-colors disabled:opacity-50"
                  :aria-label="`Look up meaning of ${row.term}`"
                >
                  <Loader2 v-if="row.loading" :size="14" class="animate-spin" />
                  <Search v-else :size="14" />
                </button>
                <button
                  v-if="row.definitions && row.definitions.length > 1"
                  type="button"
                  @click="showAlternatives = showAlternatives === row.id ? null : row.id"
                  class="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-garden-50 border border-transparent hover:border-garden-100 transition-colors"
                  :aria-label="`Show ${row.definitions.length - 1} more meanings`"
                >
                  <ChevronDown :size="14" class="transition-transform" :class="showAlternatives === row.id ? 'rotate-180' : ''" />
                </button>
              </div>

              <!-- Alternatives for the expanded row -->
              <div
                v-for="row in plantedTerms"
                :key="`alt-${row.id}`"
              >
                <div
                  v-if="showAlternatives === row.id && row.definitions && row.definitions.length > 1"
                  class="ml-[6.5rem] -mt-1 mb-1 flex flex-wrap gap-1.5 animate-fade-up"
                >
                  <button
                    v-for="(alt, i) in row.definitions"
                    :key="`alt-${row.id}-${i}`"
                    type="button"
                    @click="pickAlternative(row, alt)"
                    :class="row.definition === alt ? 'bg-garden-600 text-white' : 'bg-white border border-line text-stone-600 hover:border-garden-200 hover:bg-garden-50'"
                    class="px-2 py-1 rounded-full text-[11px] font-medium transition-colors"
                  >
                    {{ alt }}
                  </button>
                </div>
              </div>

              <!-- Wiktionary reference line. Shows the raw gloss the
                   dictionary returned — distinct from the user's own
                   'meaning' gloss above. Quiet italic so it reads as
                   supporting context, not a duplicate field. Only shows
                   after a lookup has produced at least one definition. -->
              <p
                v-if="row.definition && showAlternatives !== row.id"
                class="ml-[6.5rem] -mt-0.5 mb-1 text-[11px] italic text-stone-400 line-clamp-1"
                :title="row.definition"
              >
                <span class="text-stone-300 not-italic">def ·</span> {{ row.definition }}
              </p>
            </div>

            <p v-if="filledCount > 0" class="text-[11px] text-stone-400 mt-2">
              {{ filledCount }} of {{ plantedTerms.length }} ready to save.
            </p>

            <div class="flex items-center gap-2 pt-4 mt-4 border-t border-line">
              <span class="text-xs text-stone-400 flex-1">
                <span v-if="saving">Saving…</span>
                <span v-else>Fill what you know — leave the rest blank.</span>
              </span>
              <button
                @click="skipMeanings"
                :disabled="saving"
                class="gp-btn-ghost px-4 py-2 text-sm"
              >
                Skip
              </button>
              <button
                @click="saveMeanings"
                :disabled="saving || !filledCount"
                class="gp-btn-primary px-5 py-2 text-sm inline-flex items-center gap-1.5"
              >
                <Save :size="14" />
                Save {{ filledCount || '' }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X, Sprout, Sparkles, Check, BookMarked, Save, Search, ChevronDown, Loader2 } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { useToast } from '../../composables/useToast.js'
import { useAuth } from '../../composables/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import { codeForName, nameForCode } from '../../lib/bookLanguages.js'
import { mineCandidates } from '../../lib/vocabMining.js'
import { lookupWord } from '../../lib/dictLookup.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  book: { type: Object, default: null },
  // The user's tracked Garten languages — used to resolve book.languageCode
  // to a tracked language id (where the planted words will live).
  languages: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'planted'])

const vocab = useVocab()
const toast = useToast()
const { userId } = useAuth()

const passage = ref('')
const selected = ref(new Set())
const planting = ref(false)
// Step 2 state — populated when the previous plant succeeded. Each row is
// { id, term, meaning, loading, definitions, definitionError } where the
// lookup fields are populated on demand by the magnifier button.
const defineStep = ref(false)
const plantedTerms = ref([])
const saving = ref(false)
const showAlternatives = ref(null) // row.id, or null

// Resolve the book's language code to the matching tracked language id and
// metadata. A book saved while a language was tracked keeps its `languageCode`
// frozen in the books row; if the user later removed that language from their
// garden, mining is paused with a notice rather than silently planting to an
// orphan `language_id`.
const targetLanguageId = computed(() => {
  if (!props.book?.languageCode) return null
  const lang = props.languages.find((l) => codeForName(l.name) === props.book.languageCode)
  return lang?.id ?? null
})

const languageMeta = computed(() => {
  if (!props.book?.languageCode) return null
  const lang = props.languages.find((l) => codeForName(l.name) === props.book.languageCode)
  return { name: lang?.name || nameForCode(props.book.languageCode), color: lang?.color || null }
})

const languageCodeLabel = computed(() => (props.book?.languageCode ? nameForCode(props.book.languageCode) : ''))

// Planted terms for the resolved language only — keeps the candidate list clean
// of words the gardener already tends (cross-language dupes show as new,
// which is correct: planting "chat" in French AND English is genuinely two
// different words).
const plantedTermsLower = computed(() => {
  const id = targetLanguageId.value
  if (!id) return []
  return vocab.words.value
    .filter((w) => w.languageId === id)
    .map((w) => w.term || '')
})

const mined = computed(() =>
  mineCandidates(passage.value, {
    plantedTerms: plantedTermsLower.value,
    languageCode: props.book?.languageCode || null,
  })
)

const candidates = computed(() => mined.value.candidates)
const skipped = computed(() => mined.value.skipped)

const filledCount = computed(() => plantedTerms.value.filter((r) => r.meaning.trim()).length)

// Prefill the textarea from the book's description each time the modal opens.
watch(
  () => [props.visible, props.book?.id],
  ([vis]) => {
    if (vis) {
      passage.value = props.book?.description || ''
      selected.value = new Set()
      defineStep.value = false
      plantedTerms.value = []
      showAlternatives.value = null
    }
  },
  { immediate: true }
)

function toggle(tok) {
  const next = new Set(selected.value)
  if (next.has(tok)) next.delete(tok)
  else next.add(tok)
  selected.value = next
}

function selectAll() {
  if (selected.value.size === candidates.value.length) {
    selected.value = new Set()
  } else {
    selected.value = new Set(candidates.value)
  }
}

async function plantSelected() {
  if (!selected.value.size || !targetLanguageId.value || planting.value) return
  planting.value = true
  const toPlant = [...selected.value]
  const book = props.book
  let successCount = 0
  let duplicateCount = 0
  let firstError = null
  const justPlanted = []
  for (const tok of toPlant) {
    const result = await vocab.addWord({
      term: tok,
      meaning: '',
      languageId: targetLanguageId.value,
      sourceBookId: book?.id || null,
    })
    if (result?.word) {
      successCount += 1
      justPlanted.push({ id: result.word.id, term: result.word.term, meaning: '', definition: '', loading: false, definitions: [], definitionError: null })
    } else if (result?.duplicate) {
      duplicateCount += 1
    } else if (result?.error && !firstError) {
      firstError = result.error
    }
  }
  // Emit a celebration event so friends see "<you> planted N new words from
  // <title>" in the Garden Circle feed — one signal per batch, never one per
  // word, so the feed doesn't fill with planted-word noise. The SECURITY
  // DEFINER RPC writes the row; RLS would otherwise block direct inserts.
  if (successCount > 0 && book?.id && userId.value) {
    try {
      await supabase.rpc('emit_vocab_mined', {
        p_book_id: book.id,
        p_book_title: book.title || '',
        p_language_name: languageMeta.value?.name || '',
        p_language_color: languageMeta.value?.color || '',
        p_count: successCount,
      })
    } catch {
      // Celebration is best-effort — silent failure, mining still succeeded.
    }
  }
  emit('planted', { book, count: successCount })

  // Three distinct terminal states: nothing planted (every insert failed —
  // usually a missing migration; lead with the real DB error so the user
  // can see the cause instead of a generic "0 words"); some planted
  // (success toast, then offer to define meanings right now); only
  // duplicates (gentle note).
  if (successCount === 0 && duplicateCount === 0 && firstError) {
    toast.error(`Couldn't plant any words — ${firstError}`, 7000)
  } else if (successCount === 0 && duplicateCount > 0) {
    toast.show(`All ${duplicateCount} already growing in your garden.`, 'success', 3500)
  } else {
    toast.show(
      `Planted ${successCount} ${successCount === 1 ? 'word' : 'words'} from “${book?.title || ''}”.${duplicateCount ? ` ${duplicateCount} already growing.` : ''}`,
      'success',
      4000,
    )
  }

  // Clear the pick list. If anything planted, transition to the
  // "define meanings now" step so the user can fill the new rows in
  // place rather than coming back later.
  selected.value = new Set()
  planting.value = false
  if (justPlanted.length) {
    plantedTerms.value = justPlanted
    defineStep.value = true
  }
}

// Fetch one definition from Wiktionary. The first sense goes into
// `row.definition` (the raw reference gloss, shown as italic context
// below the input) and also seeds `row.meaning` (the user's own gloss,
// editable). The two diverge when the user types over `meaning`; on a
// re-lookup the meaning input is *not* clobbered if the user has
// already edited it, so a follow-up lookup only refreshes the reference
// line. If multiple senses come back, surface a chevron to switch
// between them.
async function lookupOne(row) {
  if (row.loading) return
  row.loading = true
  row.definitionError = null
  const res = await lookupWord(row.term, { languageCode: props.book?.languageCode || null })
  row.loading = false
  if (res.ok) {
    row.definitions = res.definitions
    if (showAlternatives.value === row.id) showAlternatives.value = null
    row.definition = res.definitions[0]
    if (!row.meaning || row.meaning.trim() === '') {
      row.meaning = res.definitions[0]
    }
  } else {
    row.definitions = []
    row.definition = ''
    row.definitionError = res.error || 'No result'
  }
}

function pickAlternative(row, alt) {
  // Switching the active sense updates the reference line and seeds the
  // user's gloss if it's still empty. If the user has typed their own
  // meaning, we leave it alone — picking a different sense is a
  // reference, not a meaning replacement.
  row.definition = alt
  if (!row.meaning || row.meaning.trim() === '') {
    row.meaning = alt
  }
  showAlternatives.value = null
}

async function saveMeanings() {
  if (saving.value) return
  const rows = plantedTerms.value.filter((r) => r.meaning.trim())
  if (!rows.length) {
    skipMeanings()
    return
  }
  saving.value = true
  for (const row of rows) {
    await vocab.updateWord(row.id, { meaning: row.meaning.trim() })
  }
  saving.value = false
  const n = rows.length
  toast.show(
    `Saved ${n} ${n === 1 ? 'meaning' : 'meanings'}.`,
    'success',
    3000,
  )
  emit('close')
}

function skipMeanings() {
  emit('close')
}
</script>