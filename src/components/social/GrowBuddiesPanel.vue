<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h3 class="gp-title text-lg">Grow buddies</h3>
        <p class="text-xs text-stone-500 mt-0.5">
          <template v-if="bloomedCount > 0">
            <span class="font-medium text-garden-700">{{ bloomedCount }} of {{ buddyPacts.length }}</span>
            in bloom together this week
          </template>
          <template v-else>Pool your minutes toward a shared weekly goal.</template>
        </p>
      </div>
      <button
        @click="$emit('propose')"
        class="gp-btn-primary px-3 py-2 text-xs"
        :disabled="friends.length === 0"
      >
        <Sprout :size="14" /> Grow together
      </button>
    </div>

    <div v-if="buddyPacts.length === 0" class="text-center py-8 text-stone-400">
      <Sprout :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No grow buddies yet.</p>
      <p class="text-xs mt-1">Pair up on a language and chase a combined goal together.</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <BuddyPactCard
        v-for="p in buddyPacts"
        :key="p.id"
        :pact="p"
        @end="$emit('end', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Sprout } from 'lucide-vue-next'
import BuddyPactCard from './BuddyPactCard.vue'

defineEmits(['propose', 'end'])

const social = inject('social')
const { buddyPacts, friends } = social

const bloomedCount = computed(
  () => buddyPacts.value.filter((p) => p.combined_minutes >= p.target_minutes).length
)
</script>
