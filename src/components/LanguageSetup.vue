<template>
  <div class="min-h-screen bg-gray-50 p-4 sm:p-8 flex items-start justify-center">
    <div class="w-full max-w-md pt-8 sm:pt-16">
      <SproutIcon class="w-10 h-10 mb-3" />
      <h1 class="font-display text-3xl font-bold text-gray-900">Welcome to Garten</h1>
      <p class="text-gray-500 mt-1 mb-8">Add the languages you're learning to get started.</p>

      <div v-if="languages.length > 0" class="space-y-2 mb-6">
        <div
          v-for="lang in languages"
          :key="lang.id"
          class="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200"
        >
          <div class="w-4 h-4 rounded-full flex-shrink-0" :style="{ backgroundColor: lang.color }"></div>
          <span class="font-medium text-gray-800 text-sm">{{ lang.name }}</span>
          <span class="text-xs text-gray-400 ml-2">{{ lang.types.join(', ') }}</span>
        </div>
      </div>

      <div v-if="!showForm">
        <button
          @click="showForm = true"
          class="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + Add a language
        </button>
      </div>

      <div v-else class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Language</label>
          <LanguageAutocomplete ref="autocompleteRef" :exclude="existingNames" @select="onLanguageSelect" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Color</label>
          <div class="flex flex-wrap gap-2.5 mt-1">
            <button v-for="c in availableColors" :key="c"
              @click="color = c"
              class="w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-black/10 transition-all"
              :class="c === color ? 'ring-2 ring-offset-2 ring-gray-500' : 'hover:scale-110'"
              :style="{ backgroundColor: c }"
            >
              <svg v-if="c === color" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
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
        <div class="flex gap-2">
          <button
            @click="cancelForm"
            class="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveLanguage"
            :disabled="!selectedLanguage"
            class="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <button
        @click="$emit('done')"
        :disabled="languages.length === 0"
        class="w-full mt-6 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ languages.length === 0 ? 'Add at least one language' : `Continue with ${languages.length} language${languages.length > 1 ? 's' : ''}` }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SproutIcon from './SproutIcon.vue'
import LanguageAutocomplete from './LanguageAutocomplete.vue'
import { ACTIVITY_TYPES } from '../lib/types.js'
import { PALETTE } from '../lib/color.js'
import { useLanguageForm } from '../composables/useLanguageForm.js'

const props = defineProps({
  languages: { type: Array, required: true }
})

const emit = defineEmits(['add-language', 'done'])

const existingNames = computed(() => props.languages.map(l => l.name))
const existingColors = computed(() => props.languages.map(l => l.color))
const usedColors = computed(() => new Set(existingColors.value.map(c => c?.toLowerCase())))
const showForm = ref(false)
const { selectedLanguage, color, selectedTypes, autocompleteRef, onLanguageSelect, toggleType, getLanguageData, reset } = useLanguageForm(existingColors)

// Only the colors actually selectable: unused ones plus the current pick.
const availableColors = computed(() =>
  PALETTE.filter(c => !usedColors.value.has(c.toLowerCase()) || c === color.value)
)

function saveLanguage() {
  const data = getLanguageData()
  if (!data) return
  emit('add-language', data)
  reset()
  showForm.value = false
}

function cancelForm() {
  reset()
  showForm.value = false
}
</script>
