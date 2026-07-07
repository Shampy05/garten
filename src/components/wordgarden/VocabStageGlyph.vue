<template>
  <!-- A word's growth at chip scale: soil seed → sprout → bloom → flourish.
       Deliberately tiny (the "garden" is the word list itself, not a scene);
       the bloom takes the language colour at reduced opacity so colour-coding
       stays consistent with the rest of the app. -->
  <svg viewBox="0 0 16 16" :width="size" :height="size" aria-hidden="true" class="flex-shrink-0">
    <!-- ground -->
    <path d="M3 13.5 H13" stroke="#d6d3d1" stroke-width="1.5" stroke-linecap="round" fill="none" />

    <template v-if="stage === 'seed'">
      <circle cx="8" cy="11.7" r="1.8" fill="#a8a29e" />
    </template>

    <template v-else-if="stage === 'sprout'">
      <path d="M8 13.5 V8.5" stroke="#4d7c57" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <path d="M8 9.5 C6.5 9.2 5.8 8 5.8 6.8 C7.3 7.1 8 8.3 8 9.5 Z" fill="#6b9c76" />
      <path d="M8 10.8 C9.5 10.5 10.2 9.3 10.2 8.1 C8.7 8.4 8 9.6 8 10.8 Z" fill="#6b9c76" />
    </template>

    <template v-else-if="stage === 'bloom'">
      <path d="M8 13.5 V6.5" stroke="#4d7c57" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <path d="M8 10.8 C9.5 10.5 10.2 9.3 10.2 8.1 C8.7 8.4 8 9.6 8 10.8 Z" fill="#6b9c76" />
      <circle cx="8" cy="5" r="2.4" :fill="bloomColor" opacity="0.85" />
      <circle cx="8" cy="5" r="0.9" fill="#fef3c7" />
    </template>

    <template v-else>
      <path d="M8 13.5 V6" stroke="#4d7c57" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <path d="M8 11.5 C6.5 11.2 5.8 10 5.8 8.8 C7.3 9.1 8 10.3 8 11.5 Z" fill="#6b9c76" />
      <path d="M8 11.5 C9.5 11.2 10.2 10 10.2 8.8 C8.7 9.1 8 10.3 8 11.5 Z" fill="#6b9c76" />
      <circle v-for="(p, i) in PETALS" :key="i" :cx="p[0]" :cy="p[1]" r="1.7" :fill="bloomColor" opacity="0.85" />
      <circle cx="8" cy="4.6" r="1.1" fill="#fef3c7" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 'seed' | 'sprout' | 'bloom' | 'flourish' — from vocabGrowthStage().
  stage: { type: String, default: 'seed' },
  color: { type: String, default: null },
  size: { type: Number, default: 16 },
})

// Five petals around (8, 4.6).
const PETALS = [
  [8, 2.6],
  [9.9, 3.9],
  [9.2, 6.1],
  [6.8, 6.1],
  [6.1, 3.9],
]

const bloomColor = computed(() => props.color || '#4d7c57')
</script>
