<template>
  <div class="group gp-card gp-card-hover p-4 sm:p-5 flex flex-col">
    <div class="flex gap-4">
      <div class="relative w-24 h-36 sm:w-28 sm:h-40 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
        <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
        <BookOpen v-else :size="28" class="text-stone-300" />
        <!-- Bookmark ribbon on the right edge: fills from top to bottom as you
             read, with a forked end at the current reading position. Lives
             inside the cover's overflow-hidden so the rounded corners clip
             it cleanly. The V at the bottom is the readable "where am I" cue,
             and the language color makes it match the rest of the shelf. -->
        <div
          v-if="hasTotalPages"
          class="absolute top-0 right-0 w-3 pointer-events-none transition-all duration-500 ease-out"
          :style="{ height: progressPct + '%' }"
          :aria-label="`${Math.round(progressPct)} percent read`"
        >
          <div
            class="w-full h-full"
            :style="{
              backgroundColor: languageColor || '#16a34a',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%)',
            }"
          ></div>
        </div>
      </div>

      <div class="flex flex-col min-w-0 flex-1">
        <h4 class="text-base sm:text-lg font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
        <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>

        <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
            {{ nameForCode(book.languageCode) }}
          </span>
        </div>

        <p v-if="hasTotalPages" class="text-xs text-stone-500 mt-2 tabular-nums">
          Page {{ currentPage }} of {{ totalPages }} · {{ stats.pctRead }}%
        </p>

        <div v-else class="rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2 mt-2 flex flex-wrap items-center gap-2">
          <p class="text-xs text-orange-800 flex-1 min-w-[10rem]">
            How long is this book? Set the page count to track pace and progress.
          </p>
          <button
            @click="$emit('log', book)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-orange-700 bg-white border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-colors active:scale-95"
          >
            Set page count
          </button>
        </div>

        <div class="flex items-center justify-end gap-1 mt-auto pt-2 flex-wrap">
          <button
            @click="$emit('capture-word', book)"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-500 bg-white border border-line hover:border-garden-400 hover:text-garden-700 hover:shadow-pill transition-all active:scale-95"
            title="Plant a single word from this page"
          >
            <BookMarked :size="12" />
            <span class="hidden sm:inline">Add a word</span>
          </button>
          <button
            @click="$emit('edit', book)"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-500 bg-white border border-line hover:border-garden-400 hover:text-garden-700 hover:shadow-pill transition-all active:scale-95"
            title="Edit book"
          >
            <Pencil :size="12" />
          </button>
          <button
            @click="$emit('remove', book)"
            class="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
            title="Remove book"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Stat tiles span the full card width (not the content column) so the
         finish date fits without truncating on narrow screens. -->
    <template v-if="hasTotalPages">
      <div class="grid grid-cols-3 gap-2 mt-3">
        <div class="bg-stone-50 rounded-xl p-2.5 text-center">
          <div class="text-base sm:text-lg font-display font-bold text-stone-800 tabular-nums">
            {{ paceTileValue }}
          </div>
          <div class="text-[10px] text-stone-400 uppercase tracking-wide">pages / day</div>
        </div>
        <div class="bg-stone-50 rounded-xl p-2.5 text-center">
          <div class="text-base sm:text-lg font-display font-bold text-stone-800 tabular-nums">
            {{ finishLabel || '—' }}
          </div>
          <div class="text-[10px] text-stone-400 uppercase tracking-wide">est. finish</div>
        </div>
        <div class="bg-stone-50 rounded-xl p-2.5 text-center">
          <div class="text-base sm:text-lg font-display font-bold text-stone-800 tabular-nums">
            {{ stats.pagesLeft }}
          </div>
          <div class="text-[10px] text-stone-400 uppercase tracking-wide">pages left</div>
        </div>
      </div>

      <template v-if="progressLoaded">
        <p v-if="stats.pace <= 0 && !stats.hasSessions" class="text-xs text-stone-400 italic mt-1.5">
          Log your first pages to see your pace.
        </p>
        <p v-else-if="stats.pace <= 0 && stats.hasSessions" class="text-xs text-stone-400 italic mt-1.5">
          No recent sessions — log pages to refresh your pace.
        </p>
        <p v-else-if="stats.lastReadDaysAgo >= 2" class="text-[11px] text-stone-400 mt-1.5">
          Last read {{ stats.lastReadDaysAgo }} days ago
        </p>
      </template>
    </template>

    <!-- Quick-log bar: one tap = one log. The full modal is one click away via "more". -->
    <div v-if="hasTotalPages" class="mt-3 pt-3 border-t border-line">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mr-1">Quick log</span>
        <button
          v-for="chip in quickChips"
          :key="chip"
          type="button"
          :disabled="submitting"
          @click="onQuickLog(chip)"
          class="px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums bg-white border border-line text-stone-600 hover:border-garden-400 hover:text-garden-700 hover:bg-garden-50/50 transition-colors active:scale-95 disabled:opacity-50"
        >
          +{{ chip }}
        </button>
        <button
          v-if="remaining > 0 && !quickChips.includes(remaining)"
          type="button"
          :disabled="submitting"
          @click="onQuickLog(remaining)"
          class="px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums bg-white border border-garden-300 text-garden-700 hover:bg-garden-50 transition-colors active:scale-95 disabled:opacity-50"
          :title="`Finish the last ${remaining} pages`"
        >
          Finish
        </button>
        <span class="flex-1"></span>
        <button
          v-if="remaining > 0"
          type="button"
          @click="$emit('log', book)"
          class="text-[11px] text-stone-400 hover:text-garden-700 transition-colors"
        >
          more
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BookOpen, BookMarked, Pencil, Trash2 } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { bookPaceStats, formatPace } from '../../lib/readingProgress.js'

const props = defineProps({
  book: { type: Object, required: true },
  languageColor: { type: String, default: null },
  // This book's reading_progress rows, filtered from the bulk-loaded history
  // by the parent — no per-card fetches.
  sessions: { type: Array, default: () => [] },
  // False when the bulk history fetch failed; pace copy hides silently.
  progressLoaded: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'remove', 'log', 'quick-log', 'capture-word'])

const submitting = ref(false)

const hasTotalPages = computed(() => Number(props.book.record?.totalPages) > 0)

const currentPage = computed(() => Number(props.book.record?.currentPage) || 0)
const totalPages = computed(() => Number(props.book.record?.totalPages) || 0)
const remaining = computed(() => Math.max(0, totalPages.value - currentPage.value))

const progressPct = computed(() => {
  if (!totalPages.value) return 0
  return Math.min(100, Math.round((currentPage.value / totalPages.value) * 100))
})

const stats = computed(() => bookPaceStats(props.sessions, props.book.record))
const paceLabel = computed(() => formatPace(stats.value.pace))
// Compact date (no weekday) — the full formatDate form gets truncated
// inside a third-width tile on mobile.
const finishLabel = computed(() =>
  stats.value.finishDate
    ? stats.value.finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
)

// The tile shows only the number ("~14" / "<1"); the tile label carries the
// unit. Em-dash when there is no pace to show.
const paceTileValue = computed(() => {
  if (!paceLabel.value) return '—'
  return paceLabel.value.replace(/\s*pages?\/day$/, '')
})

// Quick-log chip set: 5/10/20/30, filtered to what's actually left in the
// book so a "+30" never overshoots the end. "Finish" is rendered separately
// when the remaining count is non-standard.
const quickChips = computed(() => {
  const r = remaining.value
  if (r <= 0) return []
  return [5, 10, 20, 30].filter((n) => n <= r)
})

async function onQuickLog(pages) {
  if (submitting.value) return
  const n = Math.max(1, Math.round(Number(pages) || 0))
  if (!n) return
  submitting.value = true
  emit('quick-log', { book: props.book, pages: n })
  // The parent owns the await; we just hold the lock until next change.
  // A short guard window avoids double-fires if the optimistic update is slow.
  setTimeout(() => { submitting.value = false }, 600)
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
