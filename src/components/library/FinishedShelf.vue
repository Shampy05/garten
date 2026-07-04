<template>
  <div>
    <!-- Collapsed row: count + recent cover strip + chevron -->
    <button
      type="button"
      @click="expanded = !expanded"
      class="w-full text-left rounded-2xl border border-line bg-stone-50/50 hover:bg-stone-50 transition-colors px-4 py-3 flex items-center gap-3"
      :aria-expanded="expanded"
    >
      <div class="w-9 h-9 rounded-xl bg-gradient-to-b from-garden-500 to-garden-600 text-white flex items-center justify-center flex-shrink-0 shadow-pill">
        <BookMarked :size="16" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-stone-700">
          {{ books.length }} {{ books.length === 1 ? 'book finished' : 'books finished' }}
        </div>
        <div v-if="recent.length" class="text-[11px] text-stone-500 mt-0.5 truncate">
          {{ subtitleText }}
        </div>
      </div>
      <div v-if="recent.length" class="hidden sm:flex items-center -space-x-1.5 flex-shrink-0 mr-1">
        <div
          v-for="b in recent"
          :key="b.id"
          class="w-7 h-10 rounded border border-line bg-stone-100 overflow-hidden flex items-center justify-center"
          :title="b.title"
        >
          <img v-if="b.coverUrl" :src="b.coverUrl" :alt="b.title" class="w-full h-full object-cover" />
          <BookOpen v-else :size="11" class="text-stone-300" />
        </div>
      </div>
      <ChevronDown
        :size="16"
        class="text-stone-400 transition-transform duration-200 flex-shrink-0"
        :class="{ 'rotate-180': expanded }"
      />
    </button>

    <!-- Expanded: 2-col grid of read-only cards, plus a quiet remove link -->
    <div v-if="expanded" class="mt-3 animate-fade-up">
      <div v-if="books.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          v-for="book in books"
          :key="book.id"
          class="gp-card p-3 flex gap-3"
        >
          <div class="w-14 h-20 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
            <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
            <BookOpen v-else :size="18" class="text-stone-300" />
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
            <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>
            <div class="flex flex-wrap items-center gap-1.5 mt-2">
              <span class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
                {{ nameForCode(book.languageCode) }}
              </span>
              <span v-if="book.record?.rating != null" class="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                <Star :size="10" class="fill-amber-500" />
                {{ book.record.rating.toFixed(1) }}
              </span>
            </div>
            <p v-if="finishedLabel(book)" class="text-[11px] text-stone-400 mt-auto pt-1.5 tabular-nums">
              {{ finishedLabel(book) }}
            </p>
          </div>
        </div>
      </div>
      <div class="text-center mt-3">
        <button
          @click="$emit('remove-all')"
          class="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
        >
          Remove a finished book…
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ChevronDown, BookOpen, BookMarked, Star } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'

const props = defineProps({
  books: { type: Array, default: () => [] },
})

defineEmits(['remove-all'])

// Six most-recent covers for the strip. Sorted order is preserved by the
// caller (sortFinished in useShelves).
const recent = computed(() => props.books.slice(0, 6))
const expanded = ref(false)

const subtitleText = computed(() => {
  const langs = [...new Set(props.books.map((b) => b.languageCode).filter(Boolean))]
    .map((c) => nameForCode(c))
  if (langs.length === 0) return 'Tap to browse your finished books.'
  if (langs.length === 1) return `In ${langs[0]}.`
  if (langs.length === 2) return `In ${langs[0]} & ${langs[1]}.`
  return `In ${langs[0]}, ${langs[1]} & more.`
})

function finishedLabel(book) {
  const f = book.record?.finishedAt
  if (!f) return null
  const d = new Date(f + 'T00:00:00')
  return `Finished ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
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
