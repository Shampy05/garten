<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-gray-600 mr-2">Filter:</span>
      
      <button
        @click="selectLanguage(null)"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
        :class="!selectedLanguage ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        All Languages
      </button>
      
      <button
        v-for="lang in languages"
        :key="lang.id"
        @click="selectLanguage(lang.id)"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
        :class="selectedLanguage === lang.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        :style="selectedLanguage === lang.id ? { backgroundColor: lang.color } : {}"
      >
        {{ lang.name }}
      </button>
    </div>
    
    <div v-if="selectedLanguage && selectedLanguageObj" class="mt-3 flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-gray-600 mr-2">Types:</span>
      
      <button
        v-for="type in selectedLanguageObj.types"
        :key="type"
        @click="toggleType(type)"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize"
        :class="selectedTypes.includes(type) ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        :style="selectedTypes.includes(type) ? { backgroundColor: selectedLanguageObj.color } : {}"
      >
        {{ type }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  languages: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['filter-change'])

const selectedLanguage = ref(null)
const selectedTypes = ref([])

const selectedLanguageObj = computed(() => {
  return props.languages.find(l => l.id === selectedLanguage.value)
})

const selectLanguage = (langId) => {
  selectedLanguage.value = langId
  selectedTypes.value = []
  emitFilter()
}

const toggleType = (type) => {
  const index = selectedTypes.value.indexOf(type)
  if (index > -1) {
    selectedTypes.value.splice(index, 1)
  } else {
    selectedTypes.value.push(type)
  }
  emitFilter()
}

const emitFilter = () => {
  emit('filter-change', {
    language: selectedLanguage.value,
    types: [...selectedTypes.value]
  })
}

watch(() => props.languages, () => {
  if (selectedLanguage.value && !props.languages.find(l => l.id === selectedLanguage.value)) {
    selectedLanguage.value = null
    selectedTypes.value = []
    emitFilter()
  }
}, { deep: true })
</script>
