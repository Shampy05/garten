<template>
  <div class="group gp-card gp-card-hover p-3 flex gap-3">
    <div class="relative w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
      <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
      <BookOpen v-else :size="20" class="text-stone-300" />
      <div
        v-if="isReading"
        class="absolute bottom-0 inset-x-0 h-1 bg-stone-200"
      >
        <div
          class="h-full bg-garden-500 transition-all duration-500"
          :style="{ width: progressPct + '%' }"
        ></div>
      </div>
    </div>

    <div class="flex flex-col min-w-0 flex-1">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
          <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>
        </div>
        <div class="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
          <ProgressRing
            v-if="showRing"
            :current-page="book.record?.currentPage ?? 0"
            :total-pages="book.record?.totalPages"
            :size="56"
            :stroke="4"
            :start-color="languageColor || '#16a34a'"
            :end-color="languageColor ? darken(languageColor) : '#15803d'"
            :show-pages="false"
          />
          <div class="flex items-center gap-1">
            <button
              v-if="canLog"
              @click="$emit('log', book)"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-garden-700 bg-garden-50 border border-garden-200 hover:bg-garden-100 hover:border-garden-300 transition-colors active:scale-95"
              title="Log pages"
            >
              <BookPlus :size="12" /> Log
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

      <div class="flex flex-wrap items-center gap-1.5 mt-2">
        <span class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
          {{ nameForCode(book.languageCode) }}
        </span>
        <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="statusClass">
          {{ STATUS_LABELS[book.record?.status] || 'Unknown' }}
        </span>
        <span v-if="book.record?.difficulty" class="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full capitalize">
          {{ book.record.difficulty }}
        </span>
      </div>

      <div class="sm:hidden mt-2 flex items-center justify-between gap-3">
        <ProgressRing
          v-if="showRing"
          :current-page="book.record?.currentPage ?? 0"
          :total-pages="book.record?.totalPages"
          :size="48"
          :stroke="4"
          :start-color="languageColor || '#16a34a'"
          :end-color="languageColor ? darken(languageColor) : '#15803d'"
          :show-pages="false"
        />
        <button
          v-if="canLog"
          @click="$emit('log', book)"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-garden-700 bg-garden-50 border border-garden-200 hover:bg-garden-100 hover:border-garden-300 transition-colors active:scale-95"
        >
          <BookPlus :size="12" /> Log pages
        </button>
      </div>

      <div v-if="book.record?.rating != null" class="mt-2">
        <StarRating :model-value="book.record.rating" readonly :size="14" />
      </div>

      <p v-if="progressText" class="text-xs text-stone-500 mt-1.5 tabular-nums">
        {{ progressText }}
      </p>

      <p v-if="book.record?.notes" class="text-xs text-stone-400 mt-1.5 line-clamp-2">{{ book.record.notes }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen, Pencil, Trash2, BookPlus } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { STATUS_LABELS } from '../../lib/readingStats.js'
import StarRating from './StarRating.vue'
import ProgressRing from './ProgressRing.vue'

const props = defineProps({
  book: { type: Object, required: true },
  languageColor: { type: String, default: null },
})

defineEmits(['edit', 'remove', 'log'])

const isReading = computed(() => props.book.record?.status === 'reading')
const showRing = computed(() => {
  const r = props.book.record
  return r?.totalPages && (r.status === 'reading' || r.status === 'read')
})
const canLog = computed(() =>
  props.book.record?.status === 'reading' ||
  (props.book.record?.status === 'want_to_read' && props.book.record?.totalPages)
)

const progressPct = computed(() => {
  const r = props.book.record
  if (!r?.totalPages) return 0
  return Math.min(100, Math.round(((r.currentPage || 0) / r.totalPages) * 100))
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

function darken(hex) {
  if (!hex) return '#15803d'
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - 30)
  const g = Math.max(0, ((num >> 8) & 0x00ff) - 30)
  const b = Math.max(0, (num & 0x0000ff) - 30)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
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
