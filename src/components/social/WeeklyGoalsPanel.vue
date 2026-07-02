<template>
  <div class="gp-card gp-pad">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 class="gp-title text-lg">This week's goals</h3>
        <p class="text-xs text-stone-500 mt-0.5">
          <template v-if="bloomedCount > 0">
            <span class="font-medium text-garden-700">{{ bloomedCount }} of {{ sortedGoals.length }}</span>
            in bloom this week
          </template>
          <template v-else>Public promises keep the circle accountable.</template>
        </p>
      </div>
      <button @click="$emit('add')" class="gp-btn-primary px-3 py-2 text-xs flex-shrink-0">
        <Target :size="14" /> Set goal
      </button>
    </div>

    <div v-if="sortedGoals.length === 0" class="text-center py-8 text-stone-400">
      <Target :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No goals set yet this week.</p>
      <p class="text-xs mt-1">Set a weekly goal for one of your languages.</p>
    </div>

    <!-- Sorted so active goals needing attention appear before completed
         (in-bloom) ones. -->
    <div v-else class="space-y-3">
      <CommitmentCard
        v-for="goal in sortedGoals"
        :key="goal.id"
        :commitment="goal"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
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

defineEmits(['add', 'edit', 'delete'])

// Sorting: your own active goals first (they need your attention), then
// friends' active goals by progress, then completed (in-bloom) goals last.
const sortedGoals = computed(() => {
  const progress = (c) => c.logged_minutes / (c.target_minutes || 1)
  return [...props.commitments].sort((a, b) => {
    const aDone = progress(a) >= 1
    const bDone = progress(b) >= 1
    if (aDone !== bDone) return aDone ? 1 : -1
    if (!aDone) {
      if (!!a.isSelf !== !!b.isSelf) return a.isSelf ? -1 : 1
      return progress(b) - progress(a)
    }
    return 0
  })
})

const bloomedCount = computed(
  () => props.commitments.filter((c) => c.logged_minutes >= c.target_minutes).length
)
</script>
