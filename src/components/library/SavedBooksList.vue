<template>
  <div class="space-y-5">
    <!-- Filter disclosure: a single "Filter" button that, when opened, shows
         language + status chips. Default: closed, all shelves shown. -->
    <div v-if="savedBooks.length" class="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        @click="filterOpen = !filterOpen"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-line text-stone-600 hover:border-stone-300 transition-colors"
        :aria-expanded="filterOpen"
      >
        <SlidersHorizontal :size="12" />
        Filter
        <span v-if="filterCount > 0" class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-garden-600 text-white text-[10px] font-semibold tabular-nums">
          {{ filterCount }}
        </span>
      </button>
      <span v-if="filterCount > 0" class="text-[11px] text-stone-500">{{ filterSummary }}</span>
      <button
        v-if="filterCount > 0"
        type="button"
        @click="clearFilters"
        class="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
      >
        Clear
      </button>
    </div>

    <div v-if="filterOpen" class="gp-card gp-pad space-y-3 animate-fade-up">
      <div>
        <div class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Language</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            @click="languageFilter = null"
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            :class="!languageFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
          >
            All
          </button>
          <button
            v-for="code in languageCodes"
            :key="code"
            type="button"
            @click="languageFilter = code"
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            :class="languageFilter === code ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
          >
            {{ nameForCode(code) }}
          </button>
        </div>
      </div>
      <div>
        <div class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Shelf</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            @click="statusFilter = null"
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            :class="!statusFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
          >
            All
          </button>
          <button
            v-for="s in SHELF_OPTIONS"
            :key="s.key"
            type="button"
            @click="statusFilter = s.key"
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5"
            :class="statusFilter === s.key ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
          >
            <component :is="s.icon" :size="11" />
            {{ s.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Empty: no books at all -->
    <div v-if="!savedBooks.length" class="text-center py-10 text-stone-400">
      <BookOpen class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p class="text-sm">Your library is empty — find a book to add your first.</p>
    </div>

    <!-- Active shelf (Reading) -->
    <ShelfSection
      v-if="showActive"
      title="Reading"
      :count="filteredActive.length"
      :icon="BookOpen"
      :accent="atActiveCap ? 'amber' : 'garden'"
    >
      <template v-if="filteredActive.length === 0">
        <p class="text-sm text-stone-500 italic px-1 py-2">No books in Reading{{ languageFilter ? ' for this language' : '' }}.</p>
      </template>
      <template v-else>
        <div class="space-y-3">
          <ReadingSpotlightCard
            v-for="book in filteredActive"
            :key="book.id"
            :book="book"
            :language-color="languageColors[book.languageCode]"
            :sessions="sessionsByBook.get(book.id) || []"
            :progress-loaded="progressLoaded"
            @edit="$emit('edit', $event)"
            @remove="$emit('remove', $event)"
            @log="$emit('log', $event)"
            @quick-log="$emit('quick-log', $event)"
            @capture-word="$emit('capture-word', $event)"
          />
        </div>
        <p v-if="atActiveCap && queueHasMatches" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
          You're already growing {{ activeCap }} books. Finish one or move it back to Up next before starting another.
        </p>
      </template>
    </ShelfSection>

    <!-- Queue shelf (Up next) -->
    <ShelfSection
      v-if="showQueue"
      title="Up next"
      :count="filteredQueue.length"
      :icon="ListOrdered"
      accent="stone"
    >
      <template v-if="filteredQueue.length === 0">
        <p class="text-sm text-stone-500 italic px-1 py-2">No books queued{{ languageFilter ? ' for this language' : '' }}.</p>
      </template>
      <template v-else>
        <NextPickCard
          v-if="nextPick"
          :book="nextPick.book"
          :reason="nextPick.reason"
          :language-color="languageColors[nextPick.book.languageCode]"
          @move-to-reading="onMoveToReading"
          @edit="$emit('edit', $event)"
        />
        <div v-if="gridQueue.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3" :class="nextPick ? 'mt-3' : ''">
          <QueueCard
            v-for="(book, i) in gridQueue"
            :key="book.id"
            :book="book"
            :position="i + 1"
            :can-move-up="i > 0"
            :can-move-down="i < gridQueue.length - 1"
            @edit="$emit('edit', $event)"
            @remove="$emit('remove', $event)"
            @move-to-reading="onMoveToReading"
            @mark-as-read="onMarkAsRead"
            @reorder="onReorder"
          />
        </div>
      </template>
    </ShelfSection>

    <!-- Finished shelf -->
    <ShelfSection
      v-if="showFinished"
      title="Finished"
      :count="filteredFinished.length"
      :icon="BookCheck"
      accent="stone"
    >
      <FinishedShelf :books="filteredFinished" @remove="$emit('remove', $event)" @start-reread="onStartReread" />
    </ShelfSection>

    <!-- No matches across the visible shelves -->
    <p
      v-if="savedBooks.length && !filteredActive.length && !filteredQueue.length && !filteredFinished.length"
      class="text-center text-sm text-stone-500 py-6"
    >
      No books match these filters.
    </p>

    <!-- Soft cap prompt: shown when the user tries to start a 4th Reading book -->
    <ConfirmDialog
      :visible="showCapPrompt"
      title="You're already growing 3 books"
      :message="`${capPending?.book?.title || 'This book'} would be the ${activeCount + 1}th book you're reading at once. Finish one or move it back to Up next before starting another.`"
      confirm-label="Add anyway"
      cancel-label="Not yet"
      @confirm="confirmCapMove"
      @cancel="cancelCapMove"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { BookOpen, BookCheck, SlidersHorizontal, ListOrdered } from 'lucide-vue-next'
import { useShelves } from '../../composables/useShelves.js'
import { useBooks } from '../../composables/useBooks.js'
import { nameForCode } from '../../lib/bookLanguages.js'
import { computeNextPick } from '../../lib/nextPick.js'
import ReadingSpotlightCard from './ReadingSpotlightCard.vue'
import NextPickCard from './NextPickCard.vue'
import QueueCard from './QueueCard.vue'
import FinishedShelf from './FinishedShelf.vue'
import ShelfSection from './ShelfSection.vue'
import ConfirmDialog from '../ConfirmDialog.vue'

const props = defineProps({
  savedBooks: { type: Array, default: () => [] },
  languageColors: { type: Object, default: () => ({}) },
  // Study data from useStorage, threaded down by LibraryView so the next-pick
  // ladder can spot neglected languages — no new reads.
  entries: { type: Array, default: () => [] },
  studyLanguages: { type: Array, default: () => [] },
})

const emit = defineEmits(['edit', 'remove', 'log', 'quick-log', 'mark-as-read', 'reorder', 'start-reread', 'capture-word'])

const shelves = useShelves()

// Bulk-loaded reading history (module singleton — one query per session,
// shared with App.vue's Recent Sessions). Grouped per book once here so each
// spotlight card gets its own sessions without any per-card fetches.
const { readingProgress, progressLoaded } = useBooks()
const sessionsByBook = computed(() => {
  const map = new Map()
  for (const row of readingProgress.value) {
    if (!map.has(row.bookId)) map.set(row.bookId, [])
    map.get(row.bookId).push(row)
  }
  return map
})

const SHELF_OPTIONS = [
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'want_to_read', label: 'Up next', icon: ListOrdered },
  { key: 'read', label: 'Finished', icon: BookCheck },
]

const filterOpen = ref(false)
const languageFilter = ref(null)
const statusFilter = ref(null)

const filterCount = computed(() => (languageFilter.value ? 1 : 0) + (statusFilter.value ? 1 : 0))
const filterSummary = computed(() => {
  const parts = []
  if (languageFilter.value) parts.push(nameForCode(languageFilter.value))
  if (statusFilter.value) parts.push(SHELF_OPTIONS.find((s) => s.key === statusFilter.value)?.label)
  return parts.join(' · ')
})

function clearFilters() {
  languageFilter.value = null
  statusFilter.value = null
}

const languageCodes = computed(() => {
  const set = new Set(props.savedBooks.map((b) => b.languageCode).filter(Boolean))
  return [...set].sort((a, b) => nameForCode(a).localeCompare(nameForCode(b)))
})

// Re-derive shelf contents from the shared composable so all three sections
// react to the same source of truth.
const active = shelves.active
const queue = shelves.queue
const finished = shelves.finished
const atActiveCap = shelves.atActiveCap
const activeCount = shelves.activeCount
const activeCap = shelves.activeCap

const filteredActive = computed(() =>
  active.value.filter((b) => !languageFilter.value || b.languageCode === languageFilter.value)
)
const filteredQueue = computed(() =>
  queue.value.filter((b) => !languageFilter.value || b.languageCode === languageFilter.value)
)
const filteredFinished = computed(() =>
  finished.value.filter((b) => !languageFilter.value || b.languageCode === languageFilter.value)
)

// "Your next read" — one spotlighted pick above the queue grid, derived from
// the *filtered* queue so it always belongs to what's on screen. The grid
// below excludes the pick; reorder passes the grid's ids as visibleIds, so
// the excluded pick behaves exactly like a filter-hidden row (runReorder's
// leapfrog keeps its slot intact).
const nextPick = computed(() =>
  computeNextPick({
    queue: filteredQueue.value,
    activeBooks: active.value,
    finishedBooks: finished.value,
    entries: props.entries,
    languages: props.studyLanguages,
  })
)
const gridQueue = computed(() => {
  const pickId = nextPick.value?.book?.id
  if (!pickId) return filteredQueue.value
  return filteredQueue.value.filter((b) => b.id !== pickId)
})

const showActive = computed(() => !statusFilter.value || statusFilter.value === 'reading')
const showQueue = computed(() => !statusFilter.value || statusFilter.value === 'want_to_read')
const showFinished = computed(() => !statusFilter.value || statusFilter.value === 'read')

// Hide the cap warning if the queue is empty in the visible language filter.
const queueHasMatches = computed(() => filteredQueue.value.length > 0)

// If the active language filter no longer matches any book (e.g. the last
// book of that language was removed), reset it so the user isn't stranded.
watch(languageCodes, (codes) => {
  if (languageFilter.value && !codes.includes(languageFilter.value)) languageFilter.value = null
})

// ── Soft cap prompt ────────────────────────────────────────────────────────
const showCapPrompt = ref(false)
// A pending cap-confirm carries both the book and which action triggered
// it (moveToReading from the queue, or startReread from Finished), so the
// "Add anyway" button force-bypasses the cap for the right call.
const capPending = ref(null) // { book, action: 'moveToReading' | 'startReread' }

async function onMoveToReading(book) {
  const result = await shelves.moveToReading(book.id)
  if (result?.needsConfirmation) {
    capPending.value = { book, action: 'moveToReading' }
    showCapPrompt.value = true
  }
}
async function onStartReread(book) {
  const result = await shelves.startReread(book.id)
  if (result?.needsConfirmation) {
    capPending.value = { book, action: 'startReread' }
    showCapPrompt.value = true
  }
}
async function confirmCapMove() {
  if (!capPending.value) return
  const { book, action } = capPending.value
  if (action === 'startReread') {
    await shelves.startReread(book.id, { force: true })
  } else {
    await shelves.moveToReading(book.id, { force: true })
  }
  capPending.value = null
  showCapPrompt.value = false
}
function cancelCapMove() {
  capPending.value = null
  showCapPrompt.value = false
}

async function onMarkAsRead(book) {
  await shelves.markAsRead(book.id)
}
async function onReorder({ book, direction }) {
  // Pass the visible (language-filtered, pick-excluded) order so a reorder
  // swaps with the neighbour the user actually sees, not a hidden row.
  await shelves.reorderQueue(book.id, direction, gridQueue.value.map((b) => b.id))
}
</script>
