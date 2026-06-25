<template>
  <div class="space-y-4">
    <div class="gp-card gp-pad">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="sm:w-44 flex-shrink-0">
          <label class="block text-xs font-medium text-stone-500 mb-1">Language</label>
          <select :value="selectedLanguageId" @change="onLanguageChange" class="gp-input">
            <option value="">All languages</option>
            <option v-for="lang in languageOptions" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-stone-500 mb-1">Title or author</label>
          <div class="relative">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="e.g. Le Petit Prince"
              class="gp-input pl-9 pr-9"
              @input="search"
              @keydown.enter="searchNow"
            />
            <button
              v-if="query"
              type="button"
              @click="clearSearch"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              aria-label="Clear search"
            >
              <X :size="15" />
            </button>
          </div>
        </div>
      </div>
      <p v-if="selectedLanguageName && languageCode" class="text-xs text-stone-400 mt-2">
        Showing only books in {{ selectedLanguageName }}.
      </p>
      <p v-else-if="selectedLanguageName" class="text-xs text-stone-400 mt-2">
        Searching all languages — {{ selectedLanguageName }} doesn't map to a supported book-search code.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-10 text-stone-400">
      <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50 animate-breathe" />
      <p class="text-sm">Searching the shelves…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="gp-card gp-pad text-center text-stone-500">
      <p class="text-sm mb-3">We couldn't reach the book service. Please try again.</p>
      <button @click="searchNow" class="gp-btn-primary px-5 py-2 text-sm">Retry</button>
    </div>

    <!-- Results -->
    <div v-else-if="results.length">
      <p v-if="source === 'openlibrary'" class="text-xs text-stone-400 mb-3 inline-flex items-center gap-1">
        <Info :size="12" /> Google Books is busy — showing results from Open Library.
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BookResultCard
          v-for="book in results"
          :key="book.externalId"
          :book="book"
          :saved="savedIds.includes(book.externalId)"
          @save="$emit('save', $event)"
        />
      </div>
    </div>

    <!-- Empty after a search -->
    <div v-else-if="hasSearched" class="text-center py-10 text-stone-400">
      <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p class="text-sm">No books found{{ selectedLanguageName ? ` in ${selectedLanguageName}` : '' }}. Try another title or language.</p>
    </div>

    <!-- Initial prompt -->
    <div v-else class="text-center py-10 text-stone-400">
      <BookOpen class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p class="text-sm">Search for a book to start your reading list.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Search, BookOpen, Info, X } from 'lucide-vue-next'
import { useBookSearch } from '../../composables/useBookSearch.js'
import { codeForName } from '../../lib/bookLanguages.js'
import BookResultCard from './BookResultCard.vue'

const props = defineProps({
  savedIds: { type: Array, default: () => [] },
  defaultLanguageCode: { type: String, default: null },
  // The user's tracked Garten languages — the dropdown lists all of them by
  // name. The ISO-639-1 code is used for the book search only when available.
  languages: { type: Array, default: () => [] },
})

defineEmits(['save'])

const { query, languageCode, results, source, loading, error, hasSearched, search, searchNow, setLanguage, cleanup } = useBookSearch()

const selectedLanguageId = ref('')
const searchInput = ref(null)

function clearSearch() {
  query.value = ''
  searchNow()
  searchInput.value?.focus()
}

const languageOptions = computed(() =>
  (props.languages || []).map((l) => ({
    id: l.id,
    name: l.name,
    code: codeForName(l.name) || null,
  }))
)

const selectedLanguage = computed(() =>
  languageOptions.value.find((l) => l.id === selectedLanguageId.value)
)

const selectedLanguageName = computed(() => selectedLanguage.value?.name)

onMounted(() => {
  if (props.defaultLanguageCode) {
    const match = languageOptions.value.find((l) => l.code === props.defaultLanguageCode)
    if (match) selectLanguage(match.id)
  }
})

onBeforeUnmount(cleanup)

// If the selected language is removed from the user's garden, reset the filter.
watch(languageOptions, (opts) => {
  if (selectedLanguageId.value && !opts.find((l) => l.id === selectedLanguageId.value)) {
    selectLanguage('')
  }
})

function selectLanguage(id) {
  selectedLanguageId.value = id || ''
  const lang = languageOptions.value.find((l) => l.id === id)
  setLanguage(lang?.code || null)
}

function onLanguageChange(e) {
  selectLanguage(e.target.value)
}
</script>
