<template>
  <div class="group gp-card gp-card-hover p-3 flex flex-col">
    <div class="flex gap-3">
      <div class="relative w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
        <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
        <BookOpen v-else :size="20" class="text-stone-300" />
        <!-- Bookmark ribbon on the right edge: fills from top to bottom as you
             read, with a forked end at the current reading position. Lives
             inside the cover's overflow-hidden so the rounded corners clip
             it cleanly. Replaces the old 1px bar — the V at the bottom is
             the readable "where am I" cue, and the language color makes it
             match the rest of the shelf. -->
        <div
          v-if="isReading && hasTotalPages"
          class="absolute top-0 right-0 w-2.5 pointer-events-none transition-all duration-500 ease-out"
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
        <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
        <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>

        <div class="flex flex-wrap items-center gap-1.5 mt-2">
          <span class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
            {{ nameForCode(book.languageCode) }}
          </span>
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1" :class="statusClass">
            <BookCheck v-if="isRead" :size="10" />
            {{ STATUS_LABELS[book.record?.status] || 'Unknown' }}
          </span>
        </div>

        <p v-if="progressText" class="text-xs text-stone-500 mt-1.5 tabular-nums">
          {{ progressText }}
        </p>

        <div class="flex items-center gap-1 mt-auto pt-2">
          <button
            v-if="canLog"
            @click="$emit('log', book)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-garden-700 bg-garden-50 border border-garden-200 hover:bg-garden-100 hover:border-garden-300 transition-colors active:scale-95"
          >
            <BookPlus :size="12" /> Log pages
          </button>
          <span class="flex-1"></span>
          <button
            @click="$emit('edit', book)"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-500 bg-white border border-line hover:border-garden-400 hover:text-garden-700 hover:shadow-pill transition-all active:scale-95"
            title="Edit book"
          >
            <Pencil :size="12" />
          </button>
          <button
            v-if="!isRead"
            @click="$emit('remove', book)"
            class="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
            title="Remove book"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Quick-log bar: only on actively-reading books with a known page count.
         One tap = one log. The full modal is still one click away via "more". -->
    <div v-if="isReading && hasTotalPages" class="mt-2.5 pt-2.5 border-t border-line">
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
import { BookOpen, Pencil, Trash2, BookPlus, BookCheck } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { STATUS_LABELS } from '../../lib/readingStats.js'

const props = defineProps({
  book: { type: Object, required: true },
  languageColor: { type: String, default: null },
})

const emit = defineEmits(['edit', 'remove', 'log', 'quick-log'])

const submitting = ref(false)

const isReading = computed(() => props.book.record?.status === 'reading')
const isRead = computed(() => props.book.record?.status === 'read')

const canLog = computed(() =>
  props.book.record?.status === 'reading' ||
  (props.book.record?.status === 'want_to_read' && props.book.record?.totalPages)
)

const hasTotalPages = computed(() => Number(props.book.record?.totalPages) > 0)

const currentPage = computed(() => Number(props.book.record?.currentPage) || 0)
const totalPages = computed(() => Number(props.book.record?.totalPages) || 0)
const remaining = computed(() => Math.max(0, totalPages.value - currentPage.value))

const progressPct = computed(() => {
  if (!totalPages.value) return 0
  return Math.min(100, Math.round((currentPage.value / totalPages.value) * 100))
})

const progressText = computed(() => {
  const r = props.book.record
  if (!r?.totalPages) return null
  const pagesLeft = Math.max(0, r.totalPages - (r.currentPage || 0))
  if (r.status === 'read') return `${r.totalPages} pages · finished`
  if (pagesLeft === 0) return `${r.totalPages} pages · finishing now`
  return `Page ${r.currentPage || 0} of ${r.totalPages} · ${pagesLeft} left`
})

const statusClass = computed(() => {
  switch (props.book.record?.status) {
    case 'read':
      return 'text-garden-700 bg-garden-100'
    case 'reading':
      return 'text-orange-700 bg-orange-50'
    default:
      return 'text-stone-600 bg-stone-100'
  }
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
