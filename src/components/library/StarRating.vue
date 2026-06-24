<template>
  <div
    class="inline-flex items-center gap-2"
    :class="{ 'cursor-pointer': !readonly }"
    role="img"
    :aria-label="ariaLabel"
  >
    <div
      class="relative inline-flex"
      @mouseleave="hover = null"
    >
      <!-- Background stars -->
      <div class="inline-flex">
        <Star
          v-for="i in 5"
          :key="`bg-${i}`"
          :size="size"
          class="text-stone-300"
        />
      </div>

      <!--
        Foreground stars: an exact duplicate of the background row, clipped
        horizontally to the current rating. Clipping the whole row guarantees
        the filled stars line up perfectly with the outline stars.
      -->
      <div
        class="absolute inset-0 inline-flex overflow-hidden pointer-events-none transition-all duration-150"
        :style="{ width: fillPercent + '%' }"
      >
        <Star
          v-for="i in 5"
          :key="`fg-${i}`"
          :size="size"
          class="text-yellow-400 fill-yellow-400 flex-shrink-0"
        />
      </div>

      <!-- Invisible half-star hit areas for 0.5 precision -->
      <div
        v-if="!readonly"
        class="absolute inset-0 flex"
      >
        <button
          v-for="step in 10"
          :key="step"
          type="button"
          class="h-full p-0 border-0 bg-transparent"
          style="width: 10%"
          :aria-label="`${step * 0.5} stars`"
          @mouseenter="hover = step * 0.5"
          @focus="hover = step * 0.5"
          @click="setRating(step * 0.5)"
        />
      </div>
    </div>

    <button
      v-if="!readonly && modelValue != null"
      type="button"
      class="text-[11px] text-stone-400 hover:text-stone-600 underline underline-offset-2"
      @click="setRating(null)"
    >
      Clear
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Star } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Number, default: null },
  readonly: { type: Boolean, default: false },
  size: { type: Number, default: 18 },
})

const emit = defineEmits(['update:modelValue'])

const hover = ref(null)

const effectiveRating = computed(() => {
  if (hover.value != null) return hover.value
  return props.modelValue ?? 0
})

const fillPercent = computed(() => (effectiveRating.value / 5) * 100)

function setRating(value) {
  if (props.readonly) return
  emit('update:modelValue', value)
  hover.value = null
}

const ariaLabel = computed(() => {
  if (props.modelValue == null) return 'No rating'
  return `${props.modelValue} out of 5 stars`
})
</script>
