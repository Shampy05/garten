<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="$emit('close')">
        <div class="relative gp-card shadow-hero w-full max-w-lg p-5 sm:p-6 animate-grow-in">
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <h2 class="gp-title text-base text-stone-900 inline-flex items-center gap-2">
              <Sparkles :size="16" class="text-garden-600" />
              Mine words
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

          <!-- Footer -->
          <div class="flex items-center gap-2 pt-4 mt-4 border-t border-line">
            <span class="text-xs text-stone-400 flex-1">
              <span v-if="selected.size">{{ selected.size }} selected · meaning filled in later</span>
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
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X, Sprout, Sparkles, Check } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { useToast } from '../../composables/useToast.js'
import { useAuth } from '../../composables/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import { codeForName, nameForCode } from '../../lib/bookLanguages.js'
import { mineCandidates } from '../../lib/vocabMining.js'

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
const plantedTerms = computed(() => {
  const id = targetLanguageId.value
  if (!id) return []
  return vocab.words.value
    .filter((w) => w.languageId === id)
    .map((w) => w.term || '')
})

const mined = computed(() =>
  mineCandidates(passage.value, {
    plantedTerms: plantedTerms.value,
    languageCode: props.book?.languageCode || null,
  })
)

const candidates = computed(() => mined.value.candidates)
const skipped = computed(() => mined.value.skipped)

// Prefill the textarea from the book's description each time the modal opens.
watch(
  () => [props.visible, props.book?.id],
  ([vis]) => {
    if (vis) {
      passage.value = props.book?.description || ''
      selected.value = new Set()
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
  for (const tok of toPlant) {
    const result = await vocab.addWord({
      term: tok,
      meaning: '',
      languageId: targetLanguageId.value,
      sourceBookId: book?.id || null,
    })
    if (result?.word) successCount += 1
    else if (result?.duplicate) duplicateCount += 1
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
  toast.show(
    `Planted ${successCount} ${successCount === 1 ? 'word' : 'words'} from “${book?.title || ''}”.${duplicateCount ? ` ${duplicateCount} already growing.` : ''}`,
    'success',
    4000,
  )
  // Clear selection so the batch is gone — already-planted chips now appear
  // below in the muted list and the new-candidate list reflows.
  selected.value = new Set()
  planting.value = false
}
</script>