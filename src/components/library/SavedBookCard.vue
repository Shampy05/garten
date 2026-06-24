<template>
  <div class="group gp-card gp-card-hover p-3 flex gap-3">
    <div class="w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
      <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
      <BookOpen v-else :size="20" class="text-stone-300" />
    </div>

    <div class="flex flex-col min-w-0 flex-1">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
          <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button
            @click="$emit('edit', book)"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-500 bg-white border border-line hover:border-garden-400 hover:text-garden-700 hover:shadow-pill transition-all active:scale-95"
            title="Edit book"
          >
            <Pencil :size="12" /> <span class="hidden sm:inline">Edit</span>
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

      <div v-if="book.record?.rating != null" class="mt-2">
        <StarRating :model-value="book.record.rating" readonly :size="14" />
      </div>

      <p v-if="book.record?.notes" class="text-xs text-stone-400 mt-1.5 line-clamp-2">{{ book.record.notes }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen, Pencil, Trash2 } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { STATUS_LABELS } from '../../lib/readingStats.js'
import StarRating from './StarRating.vue'

const props = defineProps({
  book: { type: Object, required: true },
})

defineEmits(['edit', 'remove'])

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
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
