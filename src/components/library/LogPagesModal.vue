<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="$emit('close')">
        <div class="relative gp-card shadow-hero w-full max-w-md p-5 sm:p-6 space-y-5 animate-grow-in">
          <!-- Header -->
          <div class="flex items-start gap-4 pb-4 border-b border-line">
            <div class="w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
              <img v-if="book?.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" />
              <BookOpen v-else :size="20" class="text-stone-300" />
            </div>
            <div class="min-w-0">
              <h2 class="gp-title text-base text-stone-900 leading-snug">{{ book?.title }}</h2>
              <p v-if="book?.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>
              <span class="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
                {{ nameForCode(book?.languageCode) }}
              </span>
            </div>
          </div>

          <!-- Progress ring -->
          <div class="flex items-center gap-5">
            <ProgressRing
              :current-page="currentPage"
              :total-pages="totalPages"
              :size="88"
              :stroke="6"
              :start-color="accentColor"
              :end-color="accentDark"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-stone-500">Current progress</p>
              <p class="text-2xl font-display font-bold text-stone-900 tabular-nums">
                {{ currentPage }}<span class="text-stone-400 text-lg font-medium">/{{ totalPages || '?' }}</span>
              </p>
              <p v-if="pace > 0" class="text-xs text-stone-500 mt-1">
                {{ pace.toFixed(1) }} pages/day · finish {{ finishLabel }}
              </p>
              <p v-else-if="totalPages" class="text-xs text-stone-500 mt-1">
                {{ remaining }} pages left
              </p>
            </div>
          </div>

          <!-- Total pages editor (only when unset) -->
          <div v-if="!totalPages" class="rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3">
            <label class="block text-xs font-semibold text-stone-700 mb-1.5">Set total pages</label>
            <input
              v-model.number="editableTotalPages"
              type="number"
              min="1"
              placeholder="e.g. 320"
              class="gp-input"
            />
          </div>

          <!-- Pages read input -->
          <div>
            <label class="block text-xs font-semibold text-stone-700 mb-2">Pages read today</label>
            <div class="flex items-center gap-2">
              <button
                @click="pagesRead = Math.max(1, pagesRead - 1)"
                class="w-10 h-10 rounded-xl border border-line bg-white text-stone-500 hover:border-garden-400 hover:text-garden-700 transition-colors flex items-center justify-center"
              >
                <Minus :size="16" />
              </button>
              <input
                v-model.number="pagesRead"
                type="number"
                min="1"
                :max="maxPagesRead"
                class="gp-input flex-1 text-center font-display font-semibold text-lg tabular-nums"
              />
              <button
                @click="pagesRead = Math.min(maxPagesRead, pagesRead + 1)"
                class="w-10 h-10 rounded-xl border border-line bg-white text-stone-500 hover:border-garden-400 hover:text-garden-700 transition-colors flex items-center justify-center"
              >
                <Plus :size="16" />
              </button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2.5">
              <button
                v-for="chip in quickChips"
                :key="chip"
                @click="pagesRead = chip"
                class="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-line text-stone-600 hover:border-garden-400 hover:text-garden-700 transition-colors"
                :class="{ 'border-garden-400 text-garden-700': pagesRead === chip }"
              >
                +{{ chip }}
              </button>
              <button
                @click="pagesRead = remaining"
                class="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-line text-stone-600 hover:border-garden-400 hover:text-garden-700 transition-colors"
              >
                Finish
              </button>
            </div>
          </div>

          <!-- Session options -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1.5">From page</label>
              <input v-model.number="fromPage" type="number" min="1" :max="totalPages" class="gp-input tabular-nums" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1.5">To page</label>
              <input v-model.number="toPage" type="number" min="1" :max="totalPages" class="gp-input tabular-nums" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-stone-700 mb-1.5">
              Minutes spent <span class="text-stone-400 font-normal">(optional)</span>
            </label>
            <input v-model.number="minutes" type="number" min="0" placeholder="e.g. 25" class="gp-input tabular-nums" />
          </div>

          <div class="flex items-center gap-3 rounded-xl border border-line bg-stone-50/50 px-4 py-3">
            <input id="logSession" v-model="logSession" type="checkbox" class="w-4 h-4 rounded border-stone-300 text-garden-600 focus:ring-garden-500" />
            <label for="logSession" class="text-sm text-stone-700 select-none">
              Log as a reading session in my garden
            </label>
          </div>

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

          <!-- Preview -->
          <div v-if="totalPages && pagesRead > 0" class="rounded-xl border border-garden-100 bg-garden-50/40 px-4 py-3">
            <p class="text-xs font-medium text-garden-700">
              After logging: page {{ previewPage }} of {{ totalPages }}
              <span class="text-garden-600">({{ previewPct }}%)</span>
            </p>
          </div>

          <div class="flex gap-3 pt-1">
            <button @click="$emit('close')" class="gp-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button
              @click="save"
              :disabled="!canSave || saving"
              class="gp-btn-primary flex-1 py-2.5 text-sm relative overflow-hidden"
            >
              <span :class="saving ? 'opacity-0' : ''">Log progress</span>
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
import { BookOpen, Minus, Plus, Loader2 } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { useBooks } from '../../composables/useBooks.js'
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
const fromPage = ref(1)
const toPage = ref(1)
const minutes = ref(null)
const notes = ref('')
const logSession = ref(true)
const saving = ref(false)
const editableTotalPages = ref(null)
const sessions = ref([])

const currentPage = computed(() => props.book?.record?.currentPage ?? 0)
const totalPages = computed(() => props.book?.record?.totalPages ?? 0)
const remaining = computed(() => Math.max(0, (totalPages.value || 0) - currentPage.value))
const maxPagesRead = computed(() => totalPages.value ? totalPages.value - currentPage.value : 9999)
const pace = computed(() => weightedPace(sessions.value))
const finish = computed(() => predictedFinish(currentPage.value, totalPages.value, pace.value))
const finishLabel = computed(() => finish.value ? formatDate(finish.value) : 'soon')
const previewPage = computed(() => Math.min(totalPages.value || 0, currentPage.value + (pagesRead.value || 0)))
const previewPct = computed(() => pct(previewPage.value, totalPages.value || 0))

const accentColor = computed(() => props.languageColor || '#16a34a')
const accentDark = computed(() => props.languageColor ? darken(props.languageColor) : '#15803d')

const quickChips = computed(() => {
  const r = remaining.value
  if (r <= 0) return []
  return [5, 10, 20, 30].filter((n) => n < r)
})

const canSave = computed(() => {
  if (!props.book) return false
  if (!totalPages.value && !editableTotalPages.value) return false
  if ((pagesRead.value || 0) <= 0) return false
  if (maxPagesRead.value > 0 && pagesRead.value > maxPagesRead.value) return false
  return true
})

watch(() => props.visible, async (v) => {
  if (v && props.book) {
    pagesRead.value = Math.min(10, remaining.value || 10)
    fromPage.value = (props.book.record?.currentPage ?? 0) + 1
    toPage.value = fromPage.value + pagesRead.value - 1
    minutes.value = null
    notes.value = ''
    logSession.value = true
    editableTotalPages.value = props.book.record?.totalPages || props.book.pageCount || null
    sessions.value = await loadProgress(props.book.id)
  }
})

watch(pagesRead, (n) => {
  toPage.value = fromPage.value + (n || 0) - 1
})

watch(fromPage, (n) => {
  toPage.value = n + (pagesRead.value || 0) - 1
})

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

  if (!props.book.record?.totalPages && editableTotalPages.value) {
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
