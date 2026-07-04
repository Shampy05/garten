<template>
  <div class="gp-card gp-card-hover p-3 flex flex-col">
    <div class="flex gap-3">
      <div class="relative w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
        <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
        <BookOpen v-else :size="20" class="text-stone-300" />
        <div
          v-if="saved"
          class="absolute top-1 right-1 w-5 h-5 rounded-full bg-garden-600 text-white flex items-center justify-center shadow-pill"
          title="In your library"
          aria-label="In your library"
        >
          <Check :size="11" />
        </div>
      </div>

      <div class="flex flex-col min-w-0 flex-1">
        <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
        <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>

        <div class="flex flex-wrap items-center gap-1 mt-1.5">
          <span v-if="book.languageCode" class="text-[10px] font-medium text-garden-700 bg-garden-50 px-1.5 py-0.5 rounded-full">
            {{ nameForCode(book.languageCode) }}
          </span>
          <span v-if="pageCount" class="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-full tabular-nums">
            {{ pageCount }} pages
          </span>
          <span v-if="publishedYear" class="text-[10px] font-medium text-stone-500 bg-stone-50 border border-stone-100 px-1.5 py-0.5 rounded-full tabular-nums">
            {{ publishedYear }}
          </span>
        </div>

        <!-- Description: collapsible snippet. 2 lines by default; tap to expand. -->
        <button
          v-if="book.description"
          type="button"
          @click="descExpanded = !descExpanded"
          class="text-left text-xs text-stone-500 mt-1.5"
          :class="descExpanded ? '' : 'line-clamp-2'"
          :title="descExpanded ? 'Tap to collapse' : 'Tap to read more'"
        >
          {{ book.description }}
        </button>
      </div>
    </div>

    <div class="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-line">
      <span v-if="book.source === 'openlibrary'" class="text-[10px] text-stone-400 inline-flex items-center gap-1" title="From Open Library">
        <Globe :size="10" /> Open Library
      </span>
      <span v-else-if="book.source === 'merged'" class="text-[10px] text-stone-400 inline-flex items-center gap-1" title="Found in both sources, deduplicated">
        <Layers :size="10" /> Both sources
      </span>
      <span v-else class="text-[10px] text-stone-400 inline-flex items-center gap-1" title="From Google Books">
        <Globe :size="10" /> Google Books
      </span>
      <span class="flex-1"></span>
      <button
        v-if="saved"
        disabled
        class="inline-flex items-center gap-1 text-xs font-medium text-garden-600 px-2.5 py-1.5"
      >
        <Check :size="13" /> In library
      </button>
      <span
        v-else-if="!supported"
        class="text-[11px] text-stone-400"
        title="This language isn't supported yet"
      >
        Unsupported language
      </span>
      <button
        v-else
        @click="$emit('save', book)"
        class="inline-flex items-center gap-1 text-xs font-medium text-stone-600 bg-white border border-line rounded-lg px-2.5 py-1.5 hover:border-garden-400 hover:text-garden-700 hover:shadow-pill transition-all active:scale-95"
      >
        <Plus :size="13" /> Save
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BookOpen, Plus, Check, Globe, Layers } from 'lucide-vue-next'
import { nameForCode, isValidCode } from '../../lib/bookLanguages.js'

const props = defineProps({
  book: { type: Object, required: true },
  saved: { type: Boolean, default: false },
})

defineEmits(['save'])

const descExpanded = ref(false)

// Only books whose language is in the curated set can be saved (the DB CHECK
// constraint enforces it). Open Library "all languages" results may fall
// outside it; surface that instead of letting the save fail.
const supported = computed(() => isValidCode(props.book.languageCode))

// Tidy page count — hide zero/null. Also accept strings in case the source
// returns pageCount as a number-as-string.
const pageCount = computed(() => {
  const n = Number(props.book.pageCount)
  return n > 0 ? n : null
})

// Just the year (or null). publishedDate is "YYYY" or "YYYY-MM-DD" depending
// on the source.
const publishedYear = computed(() => {
  const d = props.book.publishedDate
  if (!d) return null
  const m = String(d).match(/^(\d{4})/)
  return m ? m[1] : null
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
