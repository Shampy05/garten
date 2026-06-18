<template>
  <div v-if="tendingToday.length > 0" class="flex items-center gap-2 overflow-x-auto pb-0.5">
    <span class="text-[10px] font-semibold uppercase tracking-wider text-garden-600 flex-shrink-0">Tending today</span>
    <div
      v-for="gardener in tendingToday"
      :key="gardener.actorId"
      class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-white/70 border border-garden-100 flex-shrink-0"
    >
      <div
        class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
        :class="gardener.isSelf ? 'bg-stone-200 text-stone-600' : 'bg-garden-100 text-garden-700'"
      >
        {{ gardener.name[0].toUpperCase() }}
      </div>
      <span class="text-xs text-stone-600 whitespace-nowrap">
        {{ gardener.isSelf ? 'You' : gardener.name }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const social = inject('social')
const { tendingToday } = social
</script>
