<template>
  <div class="animate-fade-up">
    <!-- Header -->
    <div class="gp-card gp-pad mb-6 relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/80 to-transparent"></div>
      <div class="relative flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-b from-garden-500 to-garden-600 text-white flex items-center justify-center flex-shrink-0 shadow-pill">
          <Library :size="22" />
        </div>
        <div>
          <h1 class="font-display text-2xl font-bold text-stone-900 tracking-tight">Reading Library</h1>
          <p class="text-sm text-stone-500">Find books in your target language and track your reading.</p>
        </div>
      </div>
    </div>

    <!-- Sub-tabs -->
    <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100/80 border border-line mb-5">
      <button
        @click="subTab = 'search'"
        class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
        :class="subTab === 'search' ? 'bg-white text-garden-700 shadow-pill' : 'text-stone-500 hover:text-stone-700'"
      >
        <Search :size="14" /> Find books
      </button>
      <button
        @click="subTab = 'library'"
        class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
        :class="subTab === 'library' ? 'bg-white text-garden-700 shadow-pill' : 'text-stone-500 hover:text-stone-700'"
      >
        <BookMarked :size="14" /> My library
        <span v-if="savedBooks.length" class="ml-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-garden-100 text-garden-700 text-[10px] font-semibold">
          {{ savedBooks.length }}
        </span>
      </button>
    </div>

    <!-- Find books -->
    <BookSearch
      v-show="subTab === 'search'"
      :saved-ids="savedIds"
      :default-language-code="defaultLanguageCode"
      :languages="languages"
      @save="openSaveModal"
    />

    <!-- My library -->
    <div v-if="subTab === 'library'">
      <div v-if="!loaded && !loadError" class="text-center py-10 text-stone-400">
        <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50 animate-breathe" />
        <p class="text-sm">Gathering your books…</p>
      </div>
      <div v-else-if="loadError" class="gp-card gp-pad text-center text-stone-500 max-w-sm mx-auto">
        <p class="text-sm mb-3">We couldn't load your library.</p>
        <button @click="retryLoad" class="gp-btn-primary px-5 py-2 text-sm">Try again</button>
      </div>
      <div v-else class="space-y-5">
        <ReadingSummary :saved-books="savedBooks" />
        <SavedBooksList
      :saved-books="savedBooks"
      :language-colors="languageColorMap"
      @edit="openEditModal"
      @remove="confirmRemove"
      @log="openLogModal"
    />
      </div>
    </div>

    <SaveBookModal
      :book="saveTarget"
      :visible="showSaveModal"
      @save="handleSave"
      @close="showSaveModal = false"
    />

    <EditBookModal
      :book="editTarget"
      :visible="showEditModal"
      @save="handleEdit"
      @close="showEditModal = false"
    />

    <LogPagesModal
      :book="logTarget"
      :visible="showLogModal"
      :language-color="logTargetLanguageColor"
      @close="showLogModal = false"
      @logged="handleLogged"
    />

    <ConfirmDialog
      :visible="showRemoveConfirm"
      title="Remove book?"
      message="This removes the book and its reading record from your library. This cannot be undone."
      confirm-label="Remove"
      danger
      @confirm="executeRemove"
      @cancel="cancelRemove"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Library, Search, BookMarked, BookOpen } from 'lucide-vue-next'
import { useBooks } from '../../composables/useBooks.js'
import { useStorage } from '../../composables/useStorage.js'
import { codeForName, nameForCode } from '../../lib/bookLanguages.js'
import BookSearch from './BookSearch.vue'
import SavedBooksList from './SavedBooksList.vue'
import ReadingSummary from './ReadingSummary.vue'
import SaveBookModal from './SaveBookModal.vue'
import EditBookModal from './EditBookModal.vue'
import LogPagesModal from './LogPagesModal.vue'
import ConfirmDialog from '../ConfirmDialog.vue'

const props = defineProps({
  // The user's tracked Garten languages — used only to default the search
  // language to one they're already studying.
  languages: { type: Array, default: () => [] },
})

const { savedBooks, loaded, loadError, saveBook, updateRecord, removeBook, retryLoad } = useBooks()
const { addEntry, data: storageData } = useStorage()

const subTab = ref('search')

const languageColorMap = computed(() => {
  const map = {}
  for (const lang of props.languages) {
    map[codeForName(lang.name)] = lang.color
  }
  return map
})

const savedIds = computed(() => savedBooks.value.map((b) => b.externalId))

const defaultLanguageCode = computed(() => null)

// Save flow
const saveTarget = ref(null)
const showSaveModal = ref(false)
function openSaveModal(book) {
  saveTarget.value = book
  showSaveModal.value = true
}
async function handleSave({ volume, record }) {
  await saveBook(volume, record)
  showSaveModal.value = false
}

// Edit flow (FR10)
const editTarget = ref(null)
const showEditModal = ref(false)
function openEditModal(book) {
  editTarget.value = book
  showEditModal.value = true
}
async function handleEdit({ bookId, updates }) {
  await updateRecord(bookId, updates)
  showEditModal.value = false
}

// Log progress flow
const logTargetId = ref(null)
const showLogModal = ref(false)
const logTarget = computed(() =>
  savedBooks.value.find((b) => b.id === logTargetId.value) || null
)
const logTargetLanguageColor = computed(() => {
  if (!logTarget.value?.languageCode) return null
  return languageColorMap.value[logTarget.value.languageCode]
})
function openLogModal(book) {
  logTargetId.value = book.id
  showLogModal.value = true
}
async function handleLogged({ book, minutes, logSession }) {
  showLogModal.value = false
  logTargetId.value = null
  if (!logSession || !minutes || minutes <= 0) return
  const lang = storageData.value.languages.find((l) => codeForName(l.name) === book.languageCode)
  if (!lang) return
  await addEntry({
    date: new Date().toISOString().slice(0, 10),
    languageId: lang.id,
    type: 'reading',
    hours: 0,
    minutes: Math.round(minutes),
    notes: `Reading: ${book.title}`,
  })
}

// Remove flow (FR11)
const removeTarget = ref(null)
const showRemoveConfirm = ref(false)
function confirmRemove(book) {
  removeTarget.value = book
  showRemoveConfirm.value = true
}
function cancelRemove() {
  removeTarget.value = null
  showRemoveConfirm.value = false
}
async function executeRemove() {
  if (removeTarget.value) await removeBook(removeTarget.value.id)
  removeTarget.value = null
  showRemoveConfirm.value = false
}
</script>
