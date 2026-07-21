<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="close"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="close">
        <div class="relative gp-card shadow-hero w-full max-w-lg p-5 sm:p-6 animate-grow-in">
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <h2 class="gp-title text-base text-stone-900 inline-flex items-center gap-2">
              <BookMarked v-if="phase === 'define'" :size="16" class="text-garden-600" />
              <Camera v-else :size="16" class="text-garden-600" />
              {{ headerTitle }}
            </h2>
            <button
              @click="close"
              class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X :size="16" />
            </button>
          </div>

          <p v-if="bookTitle" class="flex items-center gap-2 mt-3 text-xs text-stone-500">
            <span>From</span>
            <span class="font-medium text-stone-700 truncate">{{ bookTitle }}</span>
          </p>

          <!-- No tracked languages at all -->
          <p v-if="!languages.length" class="mt-3 text-sm text-stone-500 text-center py-6">
            Add a language to your garden first — words need a bed to grow in.
          </p>

          <!-- Book's language isn't tracked -->
          <p v-else-if="languageUnavailable" class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <span class="font-medium">{{ bookLanguageLabel }}</span> isn't in your garden yet — add it as a tracked language first to plant words here.
          </p>

          <template v-else>
            <!-- ─── Phase: capture ─────────────────────────────────────────── -->
            <template v-if="phase === 'capture'">
              <div class="mt-3">
                <label class="block text-xs font-medium text-stone-500 mb-1">Language</label>
                <select v-model="languageId" class="gp-input">
                  <option v-for="lang in languages" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
                </select>
              </div>

              <button
                type="button"
                @click="triggerCapture"
                class="mt-3 w-full border-2 border-dashed border-line hover:border-garden-300 rounded-xl py-8 flex flex-col items-center gap-2 text-stone-500 hover:text-garden-700 hover:bg-garden-50/40 transition-colors"
              >
                <Camera :size="28" />
                <span class="text-sm font-medium">Photograph a page</span>
                <span class="text-[11px] text-stone-400">Tap to open your camera</span>
              </button>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden"
                @change="onFileChange"
              />

              <p v-if="scanErrorMessage" class="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span>{{ scanErrorMessage }}</span>
                <button
                  v-if="canRetry"
                  type="button"
                  @click="invokeOcr"
                  class="flex-shrink-0 font-medium text-red-800 hover:underline"
                >
                  Retry
                </button>
              </p>
            </template>

            <!-- ─── Phase: scanning / select ───────────────────────────────── -->
            <template v-else-if="phase === 'scanning' || phase === 'select'">
              <div class="relative rounded-xl overflow-hidden border border-line bg-stone-100 mt-3">
                <img :src="photoUrl" class="block w-full select-none" alt="Scanned page" draggable="false" />
                <svg
                  v-if="candidates.width"
                  class="absolute inset-0 w-full h-full"
                  :viewBox="`0 0 ${candidates.width} ${candidates.height}`"
                  preserveAspectRatio="none"
                >
                  <polygon
                    v-for="tok in tappableTokens"
                    :key="tok.id"
                    :points="tok.points"
                    :style="tokenStyle(tok)"
                    @click="tok.status === 'candidate' && toggle(tok.lower)"
                  />
                  <circle
                    v-for="tok in selectedTokens"
                    :key="`dot-${tok.id}`"
                    :cx="tok.quad[2]"
                    :cy="tok.quad[3]"
                    r="7"
                    fill="#287a41"
                  />
                </svg>
                <div v-if="phase === 'scanning'" class="absolute inset-0 bg-stone-900/35 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-white">
                  <Loader2 :size="24" class="animate-spin" />
                  <span class="text-sm font-medium">Reading the page…</span>
                </div>
              </div>

              <template v-if="phase === 'select'">
                <div v-if="chipTerms.length" class="mt-3">
                  <div class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                    {{ chipTerms.length }} {{ chipTerms.length === 1 ? 'word' : 'words' }} found
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="cand in chipTerms"
                      :key="cand.lower"
                      type="button"
                      @click="toggle(cand.lower)"
                      class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1"
                      :class="selected.has(cand.lower)
                        ? 'bg-garden-600 text-white shadow-pill'
                        : 'bg-white border border-line text-stone-700 hover:border-garden-200 hover:bg-garden-50'"
                    >
                      <Check v-if="selected.has(cand.lower)" :size="11" />
                      {{ cand.term }}
                    </button>
                  </div>
                </div>
                <p v-else class="mt-3 text-sm text-stone-500 italic px-1">
                  Nothing plantable found on this page.
                </p>

                <div v-if="plantedChips.length" class="mt-3 pt-2 border-t border-line">
                  <div class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                    Already planted · {{ plantedChips.length }}
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="term in plantedChips"
                      :key="`p-${term}`"
                      class="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-400 inline-flex items-center gap-1"
                    >
                      <Check :size="11" />
                      {{ term }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 pt-4 mt-4 border-t border-line">
                  <span class="text-xs text-stone-400 flex-1">
                    <span v-if="selected.size">{{ selected.size }} selected</span>
                    <span v-else>Tap words on the photo or the chips above.</span>
                  </span>
                  <button @click="retake" class="gp-btn-ghost px-4 py-2 text-sm">Retake</button>
                  <button
                    @click="plantSelected"
                    :disabled="!selected.size || planting"
                    class="gp-btn-primary px-5 py-2 text-sm inline-flex items-center gap-1.5"
                  >
                    <Sprout :size="14" />
                    Plant {{ selected.size || '' }}
                  </button>
                </div>
              </template>
            </template>

            <!-- ─── Phase: define meanings ─────────────────────────────────── -->
            <template v-else-if="phase === 'define'">
              <p class="mt-3 text-xs text-stone-500">
                <span class="font-medium text-stone-700">{{ plantedTerms.length }} new {{ plantedTerms.length === 1 ? 'word' : 'words' }}</span> planted.
                Add meanings now so they're ready for the watering round —
                skip and you can fill them in from the Word Garden later.
              </p>

              <div class="mt-3 space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                <div v-for="row in plantedTerms" :key="row.id" class="flex items-center gap-2">
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

                <template v-for="row in plantedTerms" :key="`alt-${row.id}`">
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
                  <p
                    v-if="row.definition && showAlternatives !== row.id"
                    class="ml-[6.5rem] -mt-0.5 mb-1 text-[11px] italic text-stone-400 line-clamp-1"
                    :title="row.definition"
                  >
                    <span class="text-stone-300 not-italic">def ·</span> {{ row.definition }}
                  </p>
                </template>
              </div>

              <p v-if="filledCount > 0" class="text-[11px] text-stone-400 mt-2">
                {{ filledCount }} of {{ plantedTerms.length }} ready to save.
              </p>

              <div class="flex items-center gap-2 pt-4 mt-4 border-t border-line">
                <span class="text-xs text-stone-400 flex-1">
                  <span v-if="saving">Saving…</span>
                  <span v-else>Fill what you know — leave the rest blank.</span>
                </span>
                <button @click="skipMeanings" :disabled="saving" class="gp-btn-ghost px-4 py-2 text-sm">Skip</button>
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
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X, Camera, Sprout, Check, BookMarked, Save, Search, ChevronDown, Loader2 } from 'lucide-vue-next'
import { useVocab } from '../../composables/useVocab.js'
import { useToast } from '../../composables/useToast.js'
import { supabase } from '../../lib/supabase.js'
import { codeForName, nameForCode } from '../../lib/bookLanguages.js'
import { buildOcrCandidates } from '../../lib/ocrWords.js'
import { prepareImageForOcr } from '../../lib/imagePrep.js'
import { lookupWord } from '../../lib/dictLookup.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  languages: { type: Array, default: () => [] },
  entries: { type: Array, default: () => [] },
  // Capture-from-reading presets (Library entry point). presetLanguageId is
  // null when the book's language isn't tracked at all — the modal then
  // shows an amber notice instead of a capture button, mirroring the
  // removed MineWordsModal's same guard.
  presetLanguageId: { type: String, default: null },
  sourceBookId: { type: String, default: null },
  bookTitle: { type: String, default: null },
  bookLanguageCode: { type: String, default: null },
})

const emit = defineEmits(['close', 'planted'])

const vocab = useVocab()
const toast = useToast()

const phase = ref('capture') // 'capture' | 'scanning' | 'select' | 'define'
const languageId = ref(null)
const fileInputRef = ref(null)
const photoUrl = ref(null)
const preparedImage = ref(null) // { base64, mime, blob, width, height } — kept for retry-without-recapture
const ocrPayload = ref(null) // { width, height, words }
const selected = ref(new Set())
const scanError = ref(null) // { code, message }
const planting = ref(false)

// Define-meanings step (mirrors the removed MineWordsModal's step 2).
const plantedTerms = ref([])
const saving = ref(false)
const showAlternatives = ref(null)

const languageUnavailable = computed(() => Boolean(props.sourceBookId) && !props.presetLanguageId)
const bookLanguageLabel = computed(() => (props.bookLanguageCode ? nameForCode(props.bookLanguageCode) : 'This language'))

const headerTitle = computed(() => {
  if (phase.value === 'define') return 'Add meanings'
  if (phase.value === 'select') return 'Pick words'
  return 'Scan a page'
})

function defaultLanguageId() {
  if (props.presetLanguageId && props.languages.find((l) => l.id === props.presetLanguageId)) {
    return props.presetLanguageId
  }
  if (props.languages.length === 1) return props.languages[0].id
  let latest = null
  for (const e of props.entries) {
    if (!latest || e.date > latest.date) latest = e
  }
  if (latest && props.languages.find((l) => l.id === latest.languageId)) return latest.languageId
  return props.languages[0]?.id ?? null
}

function resetState() {
  phase.value = 'capture'
  languageId.value = defaultLanguageId()
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photoUrl.value = null
  preparedImage.value = null
  ocrPayload.value = null
  selected.value = new Set()
  scanError.value = null
  planting.value = false
  plantedTerms.value = []
  saving.value = false
  showAlternatives.value = null
}

watch(() => props.visible, (vis) => { if (vis) resetState() }, { immediate: true })

function close() {
  emit('close')
}

const selectedLanguageName = computed(() => props.languages.find((l) => l.id === languageId.value)?.name || null)
const selectedLanguageCode = computed(() => codeForName(selectedLanguageName.value))

const plantedTermsLower = computed(() => {
  const id = languageId.value
  if (!id) return []
  return vocab.words.value.filter((w) => w.languageId === id).map((w) => w.term || '')
})

const candidates = computed(() =>
  ocrPayload.value
    ? buildOcrCandidates(ocrPayload.value, { plantedTerms: plantedTermsLower.value, languageCode: selectedLanguageCode.value })
    : { width: 0, height: 0, tokens: [], terms: [] }
)

const tappableTokens = computed(() => candidates.value.tokens.filter((t) => t.status !== 'skipped'))
const selectedTokens = computed(() => tappableTokens.value.filter((t) => t.status === 'candidate' && selected.value.has(t.lower)))
// Stopwords are tagged (dimmer stroke) but stay tappable on the photo itself
// — a deliberate tap shouldn't silently refuse. The chip list is
// machine-proposed, though, so stopwords are noise there and excluded.
const chipTerms = computed(() => candidates.value.terms.filter((t) => !t.stopword))
const plantedChips = computed(() => {
  const seen = new Set()
  const out = []
  for (const tok of candidates.value.tokens) {
    if (tok.status === 'planted' && !seen.has(tok.lower)) {
      seen.add(tok.lower)
      out.push(tok.term)
    }
  }
  return out
})

function tokenStyle(tok) {
  if (tok.status === 'planted') {
    return { fill: 'rgba(120,113,108,0.15)', stroke: 'none', pointerEvents: 'none', cursor: 'default' }
  }
  if (selected.value.has(tok.lower)) {
    return { fill: 'rgba(40,122,65,0.22)', stroke: '#287a41', strokeWidth: 2, vectorEffect: 'non-scaling-stroke', touchAction: 'manipulation', cursor: 'pointer' }
  }
  if (tok.stopword) {
    return { fill: 'transparent', stroke: 'rgba(40,122,65,0.25)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke', touchAction: 'manipulation', cursor: 'pointer' }
  }
  return { fill: 'transparent', stroke: 'rgba(40,122,65,0.55)', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke', touchAction: 'manipulation', cursor: 'pointer' }
}

function toggle(lower) {
  const next = new Set(selected.value)
  if (next.has(lower)) next.delete(lower)
  else next.add(lower)
  selected.value = next
}

const ERROR_COPY = {
  no_text: 'No words found on this page — try better light or a flatter page.',
  vision_error: "The scan didn't go through — you can retry without retaking the photo.",
  too_large: 'That photo is too large — try again.',
  unauthorized: 'Please sign in again.',
  bad_request: "Couldn't read that photo — try again.",
  offline: 'You look offline — scanning needs a connection.',
}
const scanErrorMessage = computed(() => {
  if (!scanError.value) return null
  return ERROR_COPY[scanError.value.code] || scanError.value.message || 'Something went wrong — please try again.'
})
// Only offer Retry (re-run OCR on the already-prepared photo) once an image
// has actually been captured — a bad_request/offline failure before that
// point has nothing to retry against.
const canRetry = computed(() => Boolean(preparedImage.value) && scanError.value?.code !== 'bad_request')

function triggerCapture() {
  fileInputRef.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  scanError.value = null
  phase.value = 'scanning'
  try {
    const prepared = await prepareImageForOcr(file)
    preparedImage.value = prepared
    if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
    photoUrl.value = URL.createObjectURL(prepared.blob)
  } catch {
    scanError.value = { code: 'bad_request' }
    phase.value = 'capture'
    return
  }
  await invokeOcr()
}

async function invokeOcr() {
  if (!preparedImage.value) return
  phase.value = 'scanning'
  scanError.value = null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    scanError.value = { code: 'offline' }
    phase.value = 'capture'
    return
  }
  const langCode = selectedLanguageCode.value
  const { data, error } = await supabase.functions.invoke('ocr-page', {
    body: {
      image: preparedImage.value.base64,
      mime: preparedImage.value.mime,
      languageHints: langCode ? [langCode] : [],
    },
  })
  if (error) {
    scanError.value = await resolveInvokeError(error)
    phase.value = 'capture'
    return
  }
  if (data?.error) {
    scanError.value = data.error
    phase.value = 'capture'
    return
  }
  ocrPayload.value = data
  selected.value = new Set()
  phase.value = 'select'
}

// supabase-js surfaces a non-2xx function response as a FunctionsHttpError
// whose `context` is the raw Response — read our own { error: { code,
// message } } body back out of it so the client shows the same copy the
// function intended, not a generic "Edge Function returned a non-2xx..."
async function resolveInvokeError(error) {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return body.error
  } catch {
    // fall through
  }
  return { code: 'vision_error', message: error?.message }
}

function retake() {
  phase.value = 'capture'
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photoUrl.value = null
  preparedImage.value = null
  ocrPayload.value = null
  selected.value = new Set()
  scanError.value = null
}

async function plantSelected() {
  if (!selected.value.size || planting.value) return
  planting.value = true
  const toPlant = candidates.value.terms.filter((t) => selected.value.has(t.lower))
  const langId = languageId.value
  let successCount = 0
  let duplicateCount = 0
  let firstError = null
  const justPlanted = []
  for (const cand of toPlant) {
    const result = await vocab.addWord({
      term: cand.term,
      meaning: '',
      languageId: langId,
      sourceBookId: props.sourceBookId,
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
  emit('planted', { count: successCount })

  if (successCount === 0 && duplicateCount === 0 && firstError) {
    toast.error(`Couldn't plant any words — ${firstError}`, 7000)
  } else if (successCount === 0 && duplicateCount > 0) {
    toast.show(`All ${duplicateCount} already growing in your garden.`, 'success', 3500)
  } else if (successCount > 0) {
    toast.show(
      `Planted ${successCount} ${successCount === 1 ? 'word' : 'words'}.${duplicateCount ? ` ${duplicateCount} already growing.` : ''}`,
      'success',
      4000,
    )
  }

  selected.value = new Set()
  planting.value = false
  if (justPlanted.length) {
    plantedTerms.value = justPlanted
    phase.value = 'define'
  }
}

const filledCount = computed(() => plantedTerms.value.filter((r) => r.meaning.trim()).length)

async function lookupOne(row) {
  if (row.loading) return
  row.loading = true
  row.definitionError = null
  const res = await lookupWord(row.term, { languageCode: selectedLanguageCode.value })
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
  toast.show(`Saved ${n} ${n === 1 ? 'meaning' : 'meanings'}.`, 'success', 3000)
  close()
}

function skipMeanings() {
  close()
}
</script>
