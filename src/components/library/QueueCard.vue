<template>
  <div class="gp-card gp-card-hover p-3 flex gap-3">
    <div class="relative w-14 h-20 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
      <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
      <BookOpen v-else :size="18" class="text-stone-300" />
      <!-- Position pip: "1" = first in the queue (next to read), "2" = second, etc. -->
      <div
        v-if="position"
        class="absolute top-1 left-1 w-5 h-5 rounded-full bg-garden-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-pill"
        :title="`Position ${position} in Up next`"
      >
        {{ position }}
      </div>
    </div>

    <div class="flex flex-col min-w-0 flex-1">
      <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
      <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>

      <div class="flex flex-wrap items-center gap-1.5 mt-2">
        <span class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
          {{ nameForCode(book.languageCode) }}
        </span>
        <span
          v-if="book.record?.difficulty"
          class="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full capitalize"
        >
          {{ book.record.difficulty }}
        </span>
      </div>

      <div class="flex items-center gap-1 mt-auto pt-2 flex-wrap">
        <button
          @click="$emit('move-to-reading', book)"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-garden-700 bg-garden-50 border border-garden-200 hover:bg-garden-100 hover:border-garden-300 transition-colors active:scale-95"
        >
          <Play :size="12" /> Move to Reading
        </button>
        <button
          v-if="canMarkRead"
          @click="$emit('mark-as-read', book)"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 bg-white border border-line hover:border-stone-300 transition-colors active:scale-95"
        >
          <BookCheck :size="12" /> Mark as read
        </button>
        <span class="flex-1"></span>
        <div class="inline-flex items-center gap-0.5">
          <button
            :disabled="!canMoveUp"
            @click="$emit('reorder', { book, direction: 'up' })"
            class="p-1.5 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-stone-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-400"
            :title="canMoveUp ? 'Move up' : 'Already at the top'"
            aria-label="Move up"
          >
            <ChevronUp :size="14" />
          </button>
          <button
            :disabled="!canMoveDown"
            @click="$emit('reorder', { book, direction: 'down' })"
            class="p-1.5 rounded-lg text-stone-400 hover:text-garden-700 hover:bg-stone-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-400"
            :title="canMoveDown ? 'Move down' : 'Already at the bottom'"
            aria-label="Move down"
          >
            <ChevronDown :size="14" />
          </button>
        </div>
        <button
          @click="$emit('edit', book)"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil :size="13" />
        </button>
        <button
          @click="$emit('remove', book)"
          class="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove"
          aria-label="Remove"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen, Pencil, Trash2, BookCheck, Play, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'

const props = defineProps({
  book: { type: Object, required: true },
  position: { type: Number, default: 0 },  // 1-indexed, 0 = no number shown
  canMoveUp: { type: Boolean, default: true },
  canMoveDown: { type: Boolean, default: true },
})

defineEmits(['edit', 'remove', 'move-to-reading', 'mark-as-read', 'reorder'])

// "Mark as read" only makes sense for books that have a known page count and
// have made any progress — otherwise the book is genuinely still unstarted.
const canMarkRead = computed(() => {
  const r = props.book.record
  if (!r) return false
  if ((r.currentPage || 0) > 0) return true
  return false
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
