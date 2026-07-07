<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="$emit('close')">
        <div class="relative gp-card shadow-hero w-full max-w-md p-5 sm:p-6 animate-grow-in">
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <h2 class="gp-title text-base text-stone-900 inline-flex items-center gap-2">
              <BookMarked :size="16" class="text-garden-600" />
              Mine words from a book
            </h2>
            <button
              @click="$emit('close')"
              class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X :size="16" />
            </button>
          </div>

          <p class="mt-3 text-xs text-stone-500">
            Pick a book you're reading or have finished. The book's description
            becomes the passage — paste your own text to mine a specific
            page instead.
          </p>

          <div v-if="!savedBooks.length" class="text-center py-8 text-sm text-stone-500">
            <p class="mb-2">No saved books yet.</p>
            <p class="text-xs text-stone-400">Head to the Library tab, search a book, and save it to your shelf.</p>
          </div>
          <div v-else class="mt-3 space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
            <button
              v-for="book in savedBooks"
              :key="book.id"
              type="button"
              @click="selectBook(book)"
              class="w-full flex items-center gap-3 p-2 rounded-lg border border-line bg-white hover:border-garden-300 hover:bg-garden-50/40 transition-colors text-left"
            >
              <div class="w-9 h-12 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
                <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" />
                <BookOpen v-else :size="14" class="text-stone-300" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-stone-800 truncate">{{ book.title }}</p>
                <p v-if="book.author" class="text-xs text-stone-500 truncate">{{ book.author }}</p>
                <p class="text-[11px] text-stone-400 mt-0.5">
                  <span class="inline-flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-full text-stone-500">
                    {{ nameForCode(book.languageCode) || '—' }}
                  </span>
                  <span v-if="book.record?.status === 'read'" class="ml-1 text-garden-600">finished</span>
                  <span v-else-if="book.record?.status === 'reading'" class="ml-1 text-amber-600">reading</span>
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { X, BookMarked, BookOpen } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  savedBooks: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'select'])

function selectBook(book) {
  emit('select', book)
}
</script>