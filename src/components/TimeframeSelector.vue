<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <button
          v-for="mode in modes"
          :key="mode.value"
          @click="$emit('mode-change', mode.value)"
          class="px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="viewMode === mode.value ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >
          {{ mode.label }}
        </button>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="$emit('navigate', -1)"
          class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Previous"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <span class="text-sm font-semibold text-gray-800 text-center select-none">
          {{ dateLabel }}
        </span>
        <button
          @click="$emit('navigate', 1)"
          class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Next"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  viewMode: { type: String, required: true },
  viewDate: { type: Date, required: true }
})

defineEmits(['mode-change', 'navigate'])

const modes = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' }
]

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const dateLabel = computed(() => {
  const d = props.viewDate
  switch (props.viewMode) {
    case 'month':
      return `${months[d.getMonth()]} ${d.getFullYear()}`
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3) + 1
      return `Q${q} - ${d.getFullYear()}`
    }
    case 'year':
      return `${d.getFullYear()}`
    default:
      return ''
  }
})
</script>
