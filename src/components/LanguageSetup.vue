<template>
  <div class="min-h-screen p-4 sm:p-8 flex items-start justify-center">
    <div class="w-full max-w-md pt-8 sm:pt-16 animate-fade-up">
      <SproutIcon class="w-12 h-12 mb-3 animate-sway" />
      <h1 class="font-display text-3xl font-bold text-stone-900 tracking-tight">Welcome to Garten</h1>
      <p class="text-stone-500 mt-1 mb-8">Plant the languages you're learning to get started.</p>

      <div v-if="languages.length > 0" class="space-y-2 mb-6">
        <div
          v-for="lang in languages"
          :key="lang.id"
          class="flex items-center gap-3 px-4 py-3 gp-card animate-grow-in"
        >
          <div class="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm" :style="{ backgroundColor: lang.color }"></div>
          <span class="font-medium text-stone-800 text-sm">{{ lang.name }}</span>
          <span class="text-xs text-stone-400 ml-2">{{ lang.types.join(', ') }}</span>
        </div>
      </div>

      <div v-if="!showForm">
        <button
          @click="showForm = true"
          class="w-full py-3 px-4 border-2 border-dashed border-stone-300 rounded-xl text-sm text-stone-500 hover:border-garden-400 hover:text-garden-700 hover:bg-garden-50/40 transition-all"
        >
          + Add a language
        </button>
      </div>

      <div v-else class="gp-card p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Language</label>
          <LanguageAutocomplete ref="autocompleteRef" :exclude="existingNames" @select="onLanguageSelect" />
        </div>
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Color</label>
          <div class="flex flex-wrap gap-2.5 mt-1">
            <button v-for="c in availableColors" :key="c"
              @click="color = c"
              class="w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-black/10 transition-all"
              :class="c === color ? 'ring-2 ring-offset-2 ring-stone-500' : 'hover:scale-110'"
              :style="{ backgroundColor: c }"
            >
              <Check v-if="c === color" class="w-4 h-4 text-white" :stroke-width="3.5" />
            </button>
          </div>
        </div>
        <div>
            <label class="block text-xs font-medium text-stone-600 mb-1">Activity Types</label>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <button
                v-for="type in ACTIVITY_TYPES"
                :key="type"
                @click="toggleType(type)"
                class="px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize"
                :class="selectedTypes.includes(type)
                  ? 'text-white border-transparent'
                  : 'text-stone-500 bg-stone-50 border-line hover:border-stone-300'"
                :style="selectedTypes.includes(type) ? { backgroundColor: color, borderColor: color } : {}"
              >
                {{ type }}
              </button>
            </div>
          </div>
        <div class="flex gap-2">
          <button
            @click="cancelForm"
            class="gp-btn-ghost flex-1 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            @click="saveLanguage"
            :disabled="!selectedLanguage"
            class="gp-btn-primary flex-1 py-2 text-sm"
          >
            Add
          </button>
        </div>
      </div>

      <button
        @click="$emit('done')"
        :disabled="languages.length === 0"
        class="gp-btn-primary w-full mt-6 py-3 text-sm"
      >
        {{ languages.length === 0 ? 'Add at least one language' : `Continue with ${languages.length} language${languages.length > 1 ? 's' : ''}` }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Check } from 'lucide-vue-next'
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
