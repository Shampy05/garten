<template>
  <button
    @click.stop="$emit('toggle')"
    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all"
    :class="liked
      ? 'bg-garden-50 border-garden-200 text-garden-700'
      : 'bg-white border-line text-stone-400 hover:border-garden-200 hover:text-garden-600'
    "
    :title="liked ? 'Unlike' : 'Celebrate this'"
  >
    <Flower2 :size="13" stroke-width="2" :class="liked ? 'text-garden-600' : ''" />
    <span v-if="total > 0" class="tabular-nums">{{ total }}</span>
  </button>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Flower2 } from 'lucide-vue-next'

const props = defineProps({
  eventId: { type: String, required: true }
})

defineEmits(['toggle'])

const social = inject('social')
const { reactionsByEvent } = social

const list = computed(() => reactionsByEvent.value[props.eventId] || [])

// Total counts every reaction ever given, including kinds from the old
// palette, so historical celebrations keep their warmth.
const total = computed(() => list.value.length)

const liked = computed(() =>
  list.value.some((r) => r.reactor_id === social.profile?.value?.id)
)
</script>
