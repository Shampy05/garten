<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">Languages</h3>
      <button 
        @click="showAddForm = !showAddForm"
        class="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        {{ showAddForm ? 'Cancel' : '+ Add Language' }}
      </button>
    </div>
    
    <div v-if="showAddForm" class="mb-4 p-4 bg-gray-50 rounded-lg">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Language Name</label>
          <input 
            v-model="newLanguage.name"
            type="text"
            placeholder="e.g., French"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
          <div class="flex items-center gap-2">
            <input 
              v-model="newLanguage.color"
              type="color"
              class="w-10 h-10 rounded cursor-pointer"
            />
            <span class="text-sm text-gray-600">{{ newLanguage.color }}</span>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Activity Types</label>
          <input 
            v-model="typesInput"
            type="text"
            placeholder="reading, grammar, vocabulary"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>
      
      <button 
        @click="addLanguage"
        class="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors"
      >
        Add Language
      </button>
    </div>
    
    <div class="flex flex-wrap gap-2">
      <div 
        v-for="lang in languages" 
        :key="lang.id"
        class="flex items-center gap-2 px-3 py-2 rounded-lg border"
        :style="{ borderColor: lang.color, backgroundColor: lang.color + '10' }"
      >
        <div 
          class="w-3 h-3 rounded-full"
          :style="{ backgroundColor: lang.color }"
        ></div>
        <span class="text-sm font-medium text-gray-700">{{ lang.name }}</span>
        <span class="text-xs text-gray-500">({{ lang.types.join(', ') }})</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  languages: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['add-language'])

const showAddForm = ref(false)
const newLanguage = ref({
  name: '',
  color: '#8b5cf6',
  types: ['reading', 'grammar', 'vocabulary']
})
const typesInput = ref('reading, grammar, vocabulary')

const addLanguage = () => {
  if (!newLanguage.value.name.trim()) return
  
  const types = typesInput.value.split(',').map(t => t.trim()).filter(t => t)
  
  emit('add-language', {
    name: newLanguage.value.name.trim(),
    color: newLanguage.value.color,
    types: types.length > 0 ? types : ['reading']
  })
  
  newLanguage.value = { name: '', color: '#8b5cf6', types: ['reading', 'grammar', 'vocabulary'] }
  typesInput.value = 'reading, grammar, vocabulary'
  showAddForm.value = false
}
</script>
