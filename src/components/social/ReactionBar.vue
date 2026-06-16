<template>
  <div class="flex flex-wrap items-center gap-1.5" :class="{ 'mt-2': !compact }">
    <button
      v-for="kind in REACTION_KINDS"
      :key="kind.kind"
      @click.stop="emit('toggle', kind.kind)"
      class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors"
      :class="hasReacted(kind.kind)
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-white border-gray-200 text-gray-500 hover:border-green-200 hover:text-green-600'
      "
      :title="kind.label"
    >
      <component :is="kind.icon" :size="compact ? 12 : 14" stroke-width="2" />
      <span v-if="countFor(kind.kind) > 0">{{ countFor(kind.kind) }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Droplets, Sun, Sprout, Leaf, Flower2, Bug, Rainbow } from 'lucide-vue-next'

const props = defineProps({
  eventId: { type: String, required: true },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle'])

const social = inject('social')
const { reactionsByEvent } = social

const REACTION_KINDS = [
  { kind: 'water', label: 'Water', icon: Droplets },
  { kind: 'sun', label: 'Sun', icon: Sun },
  { kind: 'seed', label: 'Seed', icon: Sprout },
  { kind: 'leaf', label: 'Leaf', icon: Leaf },
  { kind: 'bloom', label: 'Bloom', icon: Flower2 },
  { kind: 'bee', label: 'Bee', icon: Bug },
  { kind: 'rainbow', label: 'Rainbow', icon: Rainbow }
]

const list = computed(() => reactionsByEvent.value[props.eventId] || [])

function countFor(kind) {
  return list.value.filter((r) => r.kind === kind).length
}

function hasReacted(kind) {
  return list.value.some((r) => r.kind === kind && r.reactor_id === social.profile?.value?.id)
}
</script>
