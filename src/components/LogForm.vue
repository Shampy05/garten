<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">Log Session</h3>
      <div class="text-xs text-gray-500">Quick entry</div>
    </div>
    
    <form @submit.prevent="submitEntry" class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Language</label>
        <select 
          v-model="entry.languageId"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Select...</option>
          <option 
            v-for="lang in languages" 
            :key="lang.id" 
            :value="lang.id"
          >
            {{ lang.name }}
          </option>
        </select>
      </div>
      
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select 
          v-model="entry.type"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          :disabled="!entry.languageId"
        >
          <option value="">Select...</option>
          <option 
            v-for="type in availableTypes" 
            :key="type" 
            :value="type"
          >
            {{ type }}
          </option>
        </select>
      </div>
      
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
        <input 
          v-model.number="entry.hours"
          type="number"
          min="0"
          max="24"
          placeholder="0"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Minutes</label>
        <input 
          v-model.number="entry.minutes"
          type="number"
          min="0"
          max="59"
          placeholder="0"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input 
          v-model="entry.date"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      
      <div class="md:col-span-1">
        <button 
          type="submit"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors font-medium"
          :disabled="!isValid"
          :class="!isValid ? 'opacity-50 cursor-not-allowed' : ''"
        >
          Plant Seed
        </button>
      </div>
    </form>
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

const emit = defineEmits(['add-entry'])

const today = new Date().toISOString().split('T')[0]

const entry = ref({
  languageId: '',
  type: '',
  hours: 0,
  minutes: 30,
  date: today
})

const selectedLanguage = computed(() => {
  return props.languages.find(l => l.id === entry.value.languageId)
})

const availableTypes = computed(() => {
  return selectedLanguage.value ? selectedLanguage.value.types : []
})

watch(() => entry.value.languageId, () => {
  entry.value.type = ''
})

const isValid = computed(() => {
  return entry.value.languageId && 
         entry.value.type && 
         (entry.value.hours > 0 || entry.value.minutes > 0) &&
         entry.value.date
})

const submitEntry = () => {
  if (!isValid.value) return
  
  emit('add-entry', { ...entry.value })
  
  entry.value = {
    languageId: '',
    type: '',
    hours: 0,
    minutes: 30,
    date: today
  }
}
</script>
