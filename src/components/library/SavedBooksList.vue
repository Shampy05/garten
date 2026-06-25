<template>
  <div class="space-y-4">
    <!-- Filters (FR9) -->
    <div v-if="savedBooks.length" class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-stone-500 mr-1 inline-flex items-center gap-1.5">
          <Filter :size="14" /> Language
        </span>
        <button
          @click="languageFilter = null"
          class="px-3 py-1 rounded-full text-sm font-medium transition-all duration-200"
          :class="!languageFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
        >
          All
        </button>
        <button
          v-for="code in languageCodes"
          :key="code"
          @click="languageFilter = code"
          class="px-3 py-1 rounded-full text-sm font-medium transition-all duration-200"
          :class="languageFilter === code ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
        >
          {{ nameForCode(code) }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-stone-500 mr-1">Status</span>
        <button
          @click="statusFilter = null"
          class="px-3 py-1 rounded-full text-sm font-medium transition-all duration-200"
          :class="!statusFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
        >
          All
        </button>
        <button
          v-for="s in READING_STATUSES"
          :key="s"
          @click="statusFilter = s"
          class="px-3 py-1 rounded-full text-sm font-medium transition-all duration-200"
          :class="statusFilter === s ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
        >
          {{ STATUS_LABELS[s] }}
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div v-if="filtered.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <SavedBookCard
        v-for="book in filtered"
        :key="book.id"
        :book="book"
        @edit="$emit('edit', $event)"
        @remove="$emit('remove', $event)"
      />
    </div>

    <!-- Empty: no books at all -->
    <div v-else-if="!savedBooks.length" class="text-center py-10 text-stone-400">
      <BookOpen class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p class="text-sm">Your library is empty — find a book to add your first.</p>
    </div>

    <!-- Empty: filtered out -->
    <div v-else class="text-center py-10 text-stone-400">
      <p class="text-sm">No books match these filters.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Filter, BookOpen } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { READING_STATUSES, STATUS_LABELS } from '../../lib/readingStats.js'
import SavedBookCard from './SavedBookCard.vue'

const props = defineProps({
  savedBooks: { type: Array, default: () => [] },
})

defineEmits(['edit', 'remove'])

const languageFilter = ref(null)
const statusFilter = ref(null)

const languageCodes = computed(() => {
  const set = new Set(props.savedBooks.map((b) => b.languageCode).filter(Boolean))
  return [...set].sort((a, b) => nameForCode(a).localeCompare(nameForCode(b)))
})

const filtered = computed(() =>
  props.savedBooks.filter((b) => {
    if (languageFilter.value && b.languageCode !== languageFilter.value) return false
    if (statusFilter.value && b.record?.status !== statusFilter.value) return false
    return true
  })
)

// If the active language filter no longer exists (last book of that language
// removed), reset it so the list doesn't look mysteriously empty.
watch(languageCodes, (codes) => {
  if (languageFilter.value && !codes.includes(languageFilter.value)) languageFilter.value = null
})
</script>
