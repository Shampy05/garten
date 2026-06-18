<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h3 class="gp-title text-lg">This week's commitments</h3>
        <p class="text-xs text-stone-500 mt-0.5">
          <template v-if="bloomedCount > 0">
            <span class="font-medium text-garden-700">{{ bloomedCount }} of {{ commitments.length }}</span>
            in bloom this week
          </template>
          <template v-else>Public promises keep the circle accountable.</template>
        </p>
      </div>
      <button @click="$emit('add')" class="gp-btn-primary px-3 py-2 text-xs">
        <Target :size="14" /> Set commitment
      </button>
    </div>

    <div v-if="commitments.length === 0" class="text-center py-8 text-stone-400">
      <Target :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No commitments yet this week.</p>
      <p class="text-xs mt-1">Set one to let your circle know what you're growing.</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <CommitmentCard
        v-for="c in commitments"
        :key="c.id"
        :commitment="c"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @cheer="$emit('cheer', $event)"
        @nudge="$emit('nudge', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Target } from 'lucide-vue-next'
import CommitmentCard from './CommitmentCard.vue'

const props = defineProps({
  commitments: { type: Array, default: () => [] }
})

defineEmits(['add', 'edit', 'delete', 'cheer', 'nudge'])

// Lightweight social proof from data already loaded — how much of the circle
// has reached its commitment this week.
const bloomedCount = computed(
  () => props.commitments.filter((c) => c.logged_minutes >= c.target_minutes).length
)
</script>
