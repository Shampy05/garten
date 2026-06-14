<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24 px-4">
      <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" @click="$emit('close')"></div>

      <div class="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md max-h-[70vh] overflow-y-auto z-10">
        <!-- Header -->
        <div class="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 class="text-lg font-bold text-gray-900">Language Seeds</h2>
          <div class="flex items-center gap-2">
            <button @click="showAddForm = !showAddForm"
              class="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
            >
              + New Seed
            </button>
            <button @click="$emit('close')"
              class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Add Language Form -->
        <div v-if="showAddForm" class="border-b border-gray-100 px-5 py-4 bg-gray-50/50">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Language</label>
              <LanguageAutocomplete ref="autocompleteRef" :exclude="existingNames" @select="onLanguageSelect" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Color</label>
              <div class="flex gap-1.5 mt-1">
                <button v-for="c in PALETTE" :key="c"
                  @click="color = c"
                  class="w-8 h-8 rounded-full border-2 transition-all"
                  :class="c === color ? 'border-gray-800 scale-110' : 'border-gray-200 hover:border-gray-400'"
                  :style="{ backgroundColor: c }"
                ></button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Activity Types</label>
              <div class="flex flex-wrap gap-1.5 mt-1">
                  <button
                    v-for="type in ACTIVITY_TYPES"
                    :key="type"
                    @click="toggleType(type)"
                    class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                    :class="selectedTypes.includes(type)
                      ? 'text-white border-transparent'
                      : 'text-gray-500 bg-gray-50 border-gray-200 hover:border-gray-300'"
                    :style="selectedTypes.includes(type) ? { backgroundColor: color, borderColor: color } : {}"
                  >
                    {{ type }}
                  </button>
                </div>
              </div>
            <button @click="addLanguage" :disabled="!selectedLanguage"
              class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              Add Seed
            </button>
          </div>
        </div>

        <!-- Language Seed Packets -->
        <div class="px-5 py-4 space-y-3">
          <div v-for="lang in languages" :key="lang.id"
            class="rounded-xl overflow-hidden border-2 transition-all hover:shadow-md"
            :style="{ borderColor: lang.color + '40' }"
          >
            <div class="px-4 py-3 flex items-center gap-3" :style="{ backgroundColor: lang.color }">
              <div class="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-base shadow-inner">
                {{ lang.name[0].toUpperCase() }}
              </div>
              <span class="font-bold text-white drop-shadow-sm">{{ lang.name }}</span>
              <div class="ml-auto flex items-center gap-1.5">
                <div class="flex gap-1">
                  <button v-for="c in PALETTE" :key="c"
                    @click="updateColor(lang, c)"
                    class="w-5 h-5 rounded-full border-2 transition-all"
                    :class="c === lang.color ? 'border-white scale-125' : 'border-white/30 hover:border-white/60'"
                    :style="{ backgroundColor: c }"
                  ></button>
                </div>
                <button @click.stop="confirmDeleteLanguage(lang)"
                  class="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white/80 hover:text-white transition-colors text-xs ml-1"
                  title="Remove language"
                >✕</button>
              </div>
            </div>
            <div class="flex items-center justify-center" :style="{ backgroundColor: lang.color + '08' }">
              <div class="w-full border-t-2 border-dashed mx-3" :style="{ borderColor: lang.color + '30' }"></div>
            </div>
            <div class="px-4 py-3" :style="{ backgroundColor: lang.color + '04' }">
              <div class="text-[10px] text-gray-400 mb-1.5 font-semibold uppercase tracking-widest">Activity Types</div>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="type in lang.types" :key="type"
                  class="text-xs px-2.5 py-1 rounded-full font-medium"
                  :style="{ backgroundColor: lang.color + '30', color: lang.color }"
                >
                  {{ type }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="languages.length === 0" class="text-center py-8 text-gray-400">
            <p class="text-sm">No language seeds yet.</p>
            <p class="text-xs mt-1">Click "+ New Seed" to add your first language.</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <ConfirmDialog
    :visible="showDeleteConfirm"
    title="Delete language?"
    :message="`This will permanently remove ${deleteTarget?.name} and all its logged sessions. This cannot be undone.`"
    confirm-label="Delete"
    danger
    @confirm="executeDelete"
    @cancel="cancelDelete"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import LanguageAutocomplete from './LanguageAutocomplete.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { ACTIVITY_TYPES } from '../lib/types.js'
import { PALETTE } from '../lib/color.js'
import { useLanguageForm } from '../composables/useLanguageForm.js'

const props = defineProps({
  languages: {
    type: Array,
    required: true
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add-language', 'delete-language', 'update-language', 'close'])

const existingNames = computed(() => props.languages.map(l => l.name))
const existingColors = computed(() => props.languages.map(l => l.color))
const showAddForm = ref(false)
const { selectedLanguage, color, selectedTypes, autocompleteRef, onLanguageSelect, toggleType, getLanguageData, reset } = useLanguageForm(existingColors)

const deleteTarget = ref(null)
const showDeleteConfirm = ref(false)

function confirmDeleteLanguage(lang) {
  deleteTarget.value = lang
  showDeleteConfirm.value = true
}

function updateColor(lang, newColor) {
  emit('update-language', { id: lang.id, color: newColor })
}

function cancelDelete() {
  deleteTarget.value = null
  showDeleteConfirm.value = false
}

function executeDelete() {
  if (deleteTarget.value) {
    emit('delete-language', deleteTarget.value.id)
  }
  deleteTarget.value = null
  showDeleteConfirm.value = false
}

const addLanguage = () => {
  const data = getLanguageData()
  if (!data) return
  emit('add-language', data)
  reset()
  showAddForm.value = false
}
</script>
