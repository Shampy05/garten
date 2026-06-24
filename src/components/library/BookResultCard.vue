<template>
  <div class="gp-card gp-card-hover p-3 flex gap-3">
    <div class="w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
      <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
      <BookOpen v-else :size="20" class="text-stone-300" />
    </div>

    <div class="flex flex-col min-w-0 flex-1">
      <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
      <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>
      <p v-if="book.description" class="text-xs text-stone-400 mt-1 line-clamp-2">{{ book.description }}</p>

      <div class="flex items-center gap-2 mt-auto pt-2">
        <span v-if="book.languageCode" class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
          {{ nameForCode(book.languageCode) }}
        </span>
        <button
          v-if="saved"
          disabled
          class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-garden-600 px-2.5 py-1.5"
        >
          <Check :size="13" /> In library
        </button>
        <span
          v-else-if="!supported"
          class="ml-auto text-[11px] text-stone-400"
          title="This language isn't supported yet"
        >
          Unsupported language
        </span>
        <button
          v-else
          @click="$emit('save', book)"
          class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-stone-600 bg-white border border-line rounded-lg px-2.5 py-1.5 hover:border-garden-400 hover:text-garden-700 hover:shadow-pill transition-all active:scale-95"
        >
          <Plus :size="13" /> Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen, Plus, Check } from 'lucide-vue-next'
import { nameForCode, isValidCode } from '../../lib/bookLanguages.js'

const props = defineProps({
  book: { type: Object, required: true },
  saved: { type: Boolean, default: false },
})

defineEmits(['save'])

// Only books whose language is in the curated set can be saved (the DB CHECK
// constraint enforces it). Open Library "all languages" results may fall
// outside it; surface that instead of letting the save fail.
const supported = computed(() => isValidCode(props.book.languageCode))
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
