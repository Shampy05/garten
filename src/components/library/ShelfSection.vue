<template>
  <section>
    <div class="flex items-center gap-2 mb-3">
      <div
        class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        :class="iconBgClass"
      >
        <component :is="icon" :size="13" :class="iconFgClass" />
      </div>
      <h3 class="gp-title text-sm uppercase tracking-wider text-stone-500">{{ title }}</h3>
      <span class="text-[11px] text-stone-400 tabular-nums">{{ count }}</span>
      <span class="flex-1 h-px bg-line"></span>
    </div>
    <slot />
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 },
  icon: { type: [Object, Function], required: true },
  accent: { type: String, default: 'stone' },  // 'garden' | 'stone' | 'amber'
})

const iconBgClass = computed(() => {
  switch (props.accent) {
    case 'garden': return 'bg-garden-100'
    case 'amber':  return 'bg-amber-100'
    default:       return 'bg-stone-100'
  }
})
const iconFgClass = computed(() => {
  switch (props.accent) {
    case 'garden': return 'text-garden-700'
    case 'amber':  return 'text-amber-700'
    default:       return 'text-stone-500'
  }
})
</script>
