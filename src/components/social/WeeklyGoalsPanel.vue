<template>
  <div class="gp-card gp-pad">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 class="gp-title text-lg">This week's goals</h3>
        <p class="text-xs text-stone-500 mt-0.5">
          <template v-if="bloomedCount > 0">
            <span class="font-medium text-garden-700">{{ bloomedCount }} of {{ allGoals.length }}</span>
            in bloom this week
          </template>
          <template v-else>Public promises and shared goals keep the circle accountable.</template>
        </p>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Secondary: propose a buddy pact -->
        <button
          @click="$emit('propose')"
          class="gp-btn-ghost px-3 py-2 text-xs"
          :disabled="friends.length === 0"
          title="Grow a language together with a buddy"
        >
          <Users :size="14" /> Buddy
        </button>
        <!-- Primary: set a solo commitment -->
        <button @click="$emit('add')" class="gp-btn-primary px-3 py-2 text-xs">
          <Target :size="14" /> Set goal
        </button>
      </div>
    </div>

    <div v-if="allGoals.length === 0" class="text-center py-8 text-stone-400">
      <Target :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No goals set yet this week.</p>
      <p class="text-xs mt-1">Set a commitment or pair up with a grow buddy.</p>
    </div>

    <!-- Unified list: buddy pacts + solo commitments, sorted so active
         goals needing attention appear before completed (in-bloom) ones. -->
    <div v-else class="space-y-3">
      <template v-for="goal in allGoals" :key="goal.key">
        <BuddyPactCard
          v-if="goal.type === 'buddy'"
          :pact="goal.data"
          @end="$emit('end', $event)"
        />
        <CommitmentCard
          v-else
          :commitment="goal.data"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
          @cheer="$emit('cheer', $event)"
          @nudge="$emit('nudge', $event)"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Target, Users } from 'lucide-vue-next'
import CommitmentCard from './CommitmentCard.vue'
import BuddyPactCard from './BuddyPactCard.vue'

const props = defineProps({
  commitments: { type: Array, default: () => [] }
})

defineEmits(['add', 'edit', 'delete', 'cheer', 'nudge', 'propose', 'end'])

const social = inject('social')
const { buddyPacts, friends } = social

// Merge buddy pacts + solo commitments into one ranked list.
// Sorting: your own active goals first (need your attention), then friends'
// active goals, then completed (in-bloom) goals at the end.
const allGoals = computed(() => {
  const pacts = buddyPacts.value.map((p) => ({
    key: 'buddy-' + p.id,
    type: 'buddy',
    data: p,
    isSelf: true, // pacts always involve you
    progress: p.combined_minutes / (p.target_minutes || 1)
  }))

  const solo = props.commitments.map((c) => ({
    key: 'commit-' + c.id,
    type: 'solo',
    data: c,
    isSelf: !!c.isSelf,
    progress: c.logged_minutes / (c.target_minutes || 1)
  }))

  return [...pacts, ...solo].sort((a, b) => {
    // In-bloom (≥100%) sinks to the bottom — it's done, worth seeing but secondary
    const aDone = a.progress >= 1
    const bDone = b.progress >= 1
    if (aDone !== bDone) return aDone ? 1 : -1
    // Among active goals: self before others, then higher-progress first
    if (!aDone) {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
      return b.progress - a.progress
    }
    return 0
  })
})

const bloomedCount = computed(
  () =>
    buddyPacts.value.filter((p) => p.combined_minutes >= p.target_minutes).length +
    props.commitments.filter((c) => c.logged_minutes >= c.target_minutes).length
)
</script>
