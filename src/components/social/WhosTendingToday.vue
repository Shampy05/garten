<template>
  <div v-if="tendingToday.length > 0" class="mb-4">
    <div class="flex items-center gap-2 overflow-x-auto pb-1">
      <span class="text-xs font-medium text-gray-400 flex-shrink-0">Tending today</span>
      <div
        v-for="gardener in tendingToday"
        :key="gardener.actorId"
        class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 border border-green-100 flex-shrink-0"
      >
        <div
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          :class="gardener.isSelf ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'"
        >
          {{ gardener.name[0].toUpperCase() }}
        </div>
        <span class="text-xs text-green-800 whitespace-nowrap">
          {{ gardener.isSelf ? 'You' : gardener.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const social = inject('social')
const { tendingToday } = social
</script>
