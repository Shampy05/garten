<template>
  <div v-if="watersReceived.length > 0" class="mb-4 bg-sky-50 rounded-xl border border-sky-100 p-3">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
        <Droplets :size="16" class="fill-sky-200/50" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm text-sky-900 font-medium">
          Your garden was watered {{ countText }}
        </p>
        <p class="text-xs text-sky-700/80 mt-0.5">
          {{ namesText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Droplets } from 'lucide-vue-next'

const social = inject('social')
const { watersReceived, watersReceivedToday } = social

const countText = computed(() => {
  const n = watersReceivedToday.value
  if (n === 1) return 'once today'
  if (n === 2) return 'twice today'
  return `${n} times today`
})

const namesText = computed(() => {
  const names = watersReceived.value.map((w) => w.senderName)
  if (names.length === 0) return ''
  if (names.length === 1) return `by ${names[0]}`
  if (names.length === 2) return `by ${names[0]} and ${names[1]}`
  const first = names.slice(0, 2).join(', ')
  const rest = names.length - 2
  return `by ${first} and ${rest} other${rest === 1 ? '' : 's'}`
})
</script>
