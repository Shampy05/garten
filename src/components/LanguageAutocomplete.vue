<template>
  <div class="relative">
    <input
      v-model="query"
      type="text"
      placeholder="Search for a language..."
      autocomplete="off"
      @input="onInput"
      @keydown.down.prevent="highlightNext"
      @keydown.up.prevent="highlightPrev"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.esc="showDropdown = false"
      @blur="onBlur"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    />
    <ul
      v-if="showDropdown && matches.length > 0"
      class="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg"
    >
      <li
        v-for="(lang, i) in matches"
        :key="lang"
        @mousedown.prevent="select(lang)"
        class="px-3 py-2 text-sm cursor-pointer transition-colors"
        :class="i === highlightIndex ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'"
      >
        {{ lang }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { languages } from '../lib/languages.js'

const props = defineProps({
  exclude: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])

const query = ref('')
const showDropdown = ref(false)
const highlightIndex = ref(0)

const excludeLower = computed(() => props.exclude.map(n => n.toLowerCase()))

const matches = computed(() => {
  if (!query.value || query.value.length < 1) return []
  const q = query.value.toLowerCase()
  return languages
    .filter(l => l.toLowerCase().includes(q) && !excludeLower.value.includes(l.toLowerCase()))
    .slice(0, 8)
})

function onInput() {
  showDropdown.value = true
  highlightIndex.value = 0
}

function highlightNext() {
  if (highlightIndex.value < matches.value.length - 1) {
    highlightIndex.value++
  }
}

function highlightPrev() {
  if (highlightIndex.value > 0) {
    highlightIndex.value--
  }
}

function selectHighlighted() {
  if (matches.value[highlightIndex.value]) {
    select(matches.value[highlightIndex.value])
  }
}

function select(lang) {
  query.value = lang
  showDropdown.value = false
  emit('select', lang)
}

function onBlur() {
  setTimeout(() => { showDropdown.value = false }, 200)
}

function clear() {
  query.value = ''
  showDropdown.value = false
}

defineExpose({ clear })
</script>
