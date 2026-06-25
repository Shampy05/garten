<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="$emit('close')">
        <div class="relative gp-card shadow-hero w-full max-w-md p-5 sm:p-6 space-y-4 animate-grow-in">
          <!-- Header: book + live progress side by side -->
          <div class="flex items-center gap-4 pb-4 border-b border-line">
            <ProgressRing
              :current-page="currentPage"
              :total-pages="effectiveTotal"
              :size="64"
              :stroke="5"
              :start-color="accentColor"
              :end-color="accentDark"
              :show-pages="false"
            />
            <div class="min-w-0 flex-1">
              <h2 class="gp-title text-base text-stone-900 leading-snug line-clamp-2">{{ book?.title }}</h2>
              <p class="text-xs text-stone-500 mt-0.5 tabular-nums">
                Page {{ currentPage }}<span class="text-stone-400">/{{ effectiveTotal || '?' }}</span>
                <span v-if="pace > 0" class="text-stone-400"> · finish {{ finishLabel }}</span>
              </p>
            </div>
          </div>

          <!-- Gateway: set total pages first when it's unknown -->
          <div v-if="!effectiveTotal" class="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3">
            <label class="block text-xs font-semibold text-stone-700 mb-1.5">How many pages in this book?</label>
            <input
              v-model.number="editableTotalPages"
              type="number"
              min="1"
              placeholder="e.g. 320"
              class="gp-input tabular-nums"
              autofocus
            />
            <div class="flex items-center justify-between mt-1.5">
              <p class="text-[11px] text-stone-500">Set this once to unlock progress tracking.</p>
              <button
                type="button"
                @click="autoDetect"
                :disabled="detecting"
                class="inline-flex items-center gap-1 text-[11px] font-medium text-garden-700 hover:text-garden-800 disabled:opacity-50"
              >
                <Loader2 v-if="detecting" :size="12" class="animate-spin" />
                <Wand2 v-else :size="12" />
                {{ detecting ? 'Looking…' : 'Auto-detect' }}
              </button>
            </div>
            <p v-if="detectMsg" class="text-[11px] mt-1" :class="detectFailed ? 'text-stone-400' : 'text-garden-600'">
              {{ detectMsg }}
            </p>
          </div>

          <!-- Logging — only meaningful once we know the length -->
          <template v-else>
            <div>
              <div class="flex items-baseline justify-between mb-2">
                <label class="text-xs font-semibold text-stone-700">Pages read today</label>
                <span class="text-[11px] text-stone-400 tabular-nums">{{ remaining }} left</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="setPages(pagesRead - 1)"
                  class="w-10 h-10 rounded-xl border border-line bg-white text-stone-500 hover:border-garden-400 hover:text-garden-700 transition-colors flex items-center justify-center"
                >
                  <Minus :size="16" />
                </button>
                <input
                  :value="pagesRead"
                  @input="setPages(Number($event.target.value))"
                  type="number"
                  min="1"
                  :max="maxPagesRead"
                  class="gp-input flex-1 text-center font-display font-semibold text-lg tabular-nums"
                />
                <button
                  type="button"
                  @click="setPages(pagesRead + 1)"
                  class="w-10 h-10 rounded-xl border border-line bg-white text-stone-500 hover:border-garden-400 hover:text-garden-700 transition-colors flex items-center justify-center"
                >
                  <Plus :size="16" />
                </button>
              </div>
              <div class="flex flex-wrap gap-2 mt-2.5">
                <button
                  v-for="chip in quickChips"
                  :key="chip"
                  type="button"
                  @click="setPages(chip)"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border transition-colors"
                  :class="pagesRead === chip ? 'border-garden-400 text-garden-700' : 'border-line text-stone-600 hover:border-garden-400 hover:text-garden-700'"
                >
                  +{{ chip }}
                </button>
                <button
                  type="button"
                  @click="setPages(remaining)"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border transition-colors"
                  :class="pagesRead === remaining ? 'border-garden-400 text-garden-700' : 'border-line text-stone-600 hover:border-garden-400 hover:text-garden-700'"
                >
                  Finish
                </button>
              </div>
              <p class="text-xs text-stone-500 mt-2 tabular-nums">
                Pages {{ fromPage }}–{{ toPage }} · lands on page {{ previewPage }}
                <span class="text-garden-600">({{ previewPct }}%)</span>
              </p>
            </div>

            <!-- Optional: minutes -->
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1.5">
                Minutes spent <span class="text-stone-400 font-normal">(optional)</span>
              </label>
              <input v-model.number="minutes" type="number" min="0" placeholder="e.g. 25" class="gp-input tabular-nums" />
            </div>

            <!-- Optional: garden session toggle -->
            <label
              class="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors"
              :class="logSession ? 'border-garden-200 bg-garden-50/50' : 'border-line bg-white hover:border-stone-300'"
            >
              <input v-model="logSession" type="checkbox" class="w-4 h-4 rounded border-stone-300 text-garden-600 focus:ring-garden-500" />
              <span class="text-sm text-stone-700 select-none">Also log this as a reading session in my garden</span>
            </label>

            <!-- Optional: notes -->
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1.5">
                Notes <span class="text-stone-400 font-normal">(optional)</span>
              </label>
              <textarea
                v-model="notes"
                rows="2"
                placeholder="A scene, a word, a thought…"
                class="gp-input resize-none"
              ></textarea>
            </div>
          </template>

          <div class="flex gap-3 pt-1">
            <button @click="$emit('close')" class="gp-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button
              @click="save"
              :disabled="!canSave || saving"
              class="gp-btn-primary flex-1 py-2.5 text-sm relative overflow-hidden"
            >
              <span :class="saving ? 'opacity-0' : ''">{{ effectiveTotal ? 'Log progress' : 'Set pages' }}</span>
              <span v-if="saving" class="absolute inset-0 flex items-center justify-center">
                <Loader2 :size="18" class="animate-spin" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Minus, Plus, Loader2, Wand2 } from 'lucide-vue-next'
import { useBooks } from '../../composables/useBooks.js'
import { detectPageCount } from '../../lib/bookSearch.js'
import { weightedPace, predictedFinish, formatDate, pct } from '../../lib/readingProgress.js'
import ProgressRing from './ProgressRing.vue'

const props = defineProps({
  book: { type: Object, default: null },
  visible: { type: Boolean, default: false },
  languageColor: { type: String, default: null },
})

const emit = defineEmits(['close', 'logged'])

const { loadProgress, logProgress, updateTotalPages } = useBooks()

const pagesRead = ref(10)
const minutes = ref(null)
const notes = ref('')
const logSession = ref(true)
const saving = ref(false)
const editableTotalPages = ref(null)
const sessions = ref([])
const detecting = ref(false)
const detectMsg = ref('')
const detectFailed = ref(false)

const currentPage = computed(() => props.book?.record?.currentPage ?? 0)
const recordTotal = computed(() => props.book?.record?.totalPages ?? 0)
// The total the whole form reacts to: the saved value, or what the user is
// typing into the gateway field before the first save. Without this, setting
// the page count left the ring, chips and preview frozen until reopening.
const effectiveTotal = computed(() => recordTotal.value || editableTotalPages.value || 0)
const remaining = computed(() => Math.max(0, effectiveTotal.value - currentPage.value))
const maxPagesRead = computed(() => (effectiveTotal.value ? remaining.value : 9999))

const pace = computed(() => weightedPace(sessions.value))
const finish = computed(() => predictedFinish(currentPage.value, effectiveTotal.value, pace.value))
const finishLabel = computed(() => (finish.value ? formatDate(finish.value) : 'soon'))

// From/To and the landing page are derived from "pages read today" — no
// separate inputs to keep in sync (and contradict each other).
const fromPage = computed(() => currentPage.value + 1)
const toPage = computed(() => currentPage.value + (pagesRead.value || 0))
const previewPage = computed(() => Math.min(effectiveTotal.value || 0, toPage.value))
const previewPct = computed(() => pct(previewPage.value, effectiveTotal.value || 0))

const accentColor = computed(() => props.languageColor || '#16a34a')
const accentDark = computed(() => (props.languageColor ? darken(props.languageColor) : '#15803d'))

const quickChips = computed(() => {
  const r = remaining.value
  if (r <= 0) return []
  return [5, 10, 20, 30].filter((n) => n < r)
})

const canSave = computed(() => {
  if (!props.book) return false
  if (!effectiveTotal.value) return false
  if ((pagesRead.value || 0) <= 0) return false
  if (pagesRead.value > maxPagesRead.value) return false
  return true
})

function setPages(n) {
  const v = Math.round(Number(n) || 0)
  pagesRead.value = Math.min(maxPagesRead.value, Math.max(1, v))
}

watch(
  () => props.visible,
  async (v) => {
    if (v && props.book) {
      editableTotalPages.value = props.book.record?.totalPages || props.book.pageCount || null
      minutes.value = null
      notes.value = ''
      logSession.value = true
      detecting.value = false
      detectMsg.value = ''
      detectFailed.value = false
      sessions.value = await loadProgress(props.book.id)
      // Default to a sensible chunk, clamped to what's left.
      const left = Math.max(0, (effectiveTotal.value || 0) - (props.book.record?.currentPage ?? 0))
      pagesRead.value = left > 0 ? Math.min(10, left) : 10
    }
  }
)

async function autoDetect() {
  if (detecting.value || !props.book) return
  detecting.value = true
  detectMsg.value = ''
  detectFailed.value = false
  const pages = await detectPageCount({
    title: props.book.title,
    author: props.book.author,
    externalId: props.book.externalId,
    languageCode: props.book.languageCode,
  })
  detecting.value = false
  if (pages) {
    editableTotalPages.value = pages
    detectMsg.value = `Found ${pages} pages — adjust if it's off.`
    detectFailed.value = false
  } else {
    detectMsg.value = "Couldn't find a page count. Enter it manually."
    detectFailed.value = true
  }
}

function darken(hex) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - 30)
  const g = Math.max(0, ((num >> 8) & 0x00ff) - 30)
  const b = Math.max(0, (num & 0x0000ff) - 30)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

async function save() {
  if (!canSave.value || saving.value) return
  saving.value = true

  if (!recordTotal.value && editableTotalPages.value) {
    await updateTotalPages(props.book.id, editableTotalPages.value)
  }

  const result = await logProgress(props.book.id, {
    pagesRead: pagesRead.value,
    fromPage: fromPage.value,
    toPage: toPage.value,
    minutes: minutes.value,
    notes: notes.value,
    languageColor: props.languageColor,
  })

  saving.value = false
  if (result.error) return

  emit('logged', {
    book: result.book,
    pagesRead: result.pagesRead,
    minutes: minutes.value,
    logSession: logSession.value,
  })
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
