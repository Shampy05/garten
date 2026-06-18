<template>
  <button
    @click.stop="toggle"
    class="inline-flex items-center gap-1 text-xs font-medium transition-colors"
    :class="watered
      ? 'text-sky-600'
      : 'text-stone-400 hover:text-sky-500'
    "
    :title="watered ? `You watered ${name} today` : `Water ${name}'s garden`"
  >
    <Droplets :size="14" :class="watered ? 'fill-sky-100' : ''" />
    <span v-if="!compact">{{ watered ? 'Watered' : 'Water' }}</span>
  </button>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Droplets } from 'lucide-vue-next'

const props = defineProps({
  recipientId: { type: String, required: true },
  name: { type: String, default: 'this gardener' },
  compact: { type: Boolean, default: false }
})

const social = inject('social')
const { hasWatered, waterFriend, unwaterFriend } = social

const watered = computed(() => hasWatered(props.recipientId))

async function toggle() {
  if (watered.value) {
    await unwaterFriend(props.recipientId)
  } else {
    await waterFriend(props.recipientId)
  }
}
</script>
