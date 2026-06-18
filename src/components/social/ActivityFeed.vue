<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between mb-3">
      <h3 class="gp-title text-lg">Garden dispatches</h3>
    </div>

    <WatersReceivedBanner />
    <TogetherThisWeek />
    <WhosTendingToday />

    <div v-if="feed.length === 0" class="text-center py-8 text-stone-400">
      <Sprout :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No dispatches yet.</p>
      <p class="text-xs mt-1">When you or a friend logs a session, it lands here.</p>
    </div>

    <div v-else class="mt-1">
      <div
        v-for="item in summaryItems"
        :key="item.id"
        class="relative group"
      >
        <HarvestCard
          :item="item"
          @click="openDetail(item)"
          class="cursor-pointer"
        />
        <button
          v-if="item.isSelf"
          @click.stop="confirmRemove(item)"
          class="absolute top-3 right-3 p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="Remove harvest"
        >
          <Trash2 :size="14" />
        </button>
      </div>

      <div
        v-for="item in nonSummaryItems"
        :key="item.id"
        class="group flex items-start gap-3 rounded-xl px-2 py-2.5 -mx-2 hover:bg-stone-50/80 transition-colors cursor-pointer"
        @click="openDetail(item)"
      >
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0 mt-0.5 ring-2 ring-white shadow-sm"
          :class="item.isSelf ? 'bg-stone-100 text-stone-500' : 'bg-garden-50 text-garden-700'"
        >
          {{ item.actorName[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-stone-700 leading-snug">
            <span class="font-medium">{{ item.isSelf ? 'You' : item.actorName }}</span>

            <template v-if="item.kind === 'session'">
              tended
              <span class="inline-flex items-center gap-1 align-baseline">
                <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                <span class="font-medium">{{ item.language_name || 'a language' }}</span>
              </span>
              for {{ fmtDuration(item.minutes) }}<span v-if="item.activity_type" class="text-stone-400"> · {{ item.activity_type }}</span>
            </template>

            <template v-else-if="item.kind === 'milestone'">
              reached a <span class="font-medium text-orange-500">{{ item.streak_days }}-day streak</span> in
              <span class="inline-flex items-center gap-1 align-baseline">
                <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                <span class="font-medium">{{ item.language_name || 'a language' }}</span>
              </span>
            </template>

            <template v-else-if="item.kind === 'bloom'">
              and <span class="font-medium">{{ item.coActorIsSelf ? 'you' : item.coActorName }}</span>
              cross-pollinated
              <span class="inline-flex items-center gap-1 align-baseline">
                <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                <span class="font-medium">{{ item.language_name || 'a language' }}</span>
              </span>
            </template>
          </p>
          <div class="text-xs text-stone-400 mt-0.5">{{ relDay(item.occurred_on) }}</div>

          <div class="flex items-center justify-between mt-2">
            <ReactionBar :event-id="item.id" compact @toggle="(k) => social.toggleReaction(item.id, k)" />
            <div class="flex items-center gap-3">
              <WaterButton
                v-if="!item.isSelf"
                :recipient-id="item.actor_id"
                :name="item.actorName"
                compact
              />
              <button
                v-if="item.isSelf"
                @click.stop="confirmRemove(item)"
                class="text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove dispatch"
              >
                <Trash2 :size="14" />
              </button>
              <button
                @click.stop="openDetail(item)"
                class="text-stone-400 hover:text-garden-600 transition-colors"
                title="Open garden notes"
              >
                <MessageCircle :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ConfirmDialog
    :visible="!!removeTarget"
    title="Remove dispatch?"
    :message="removeTarget ? 'This removes the dispatch from your garden circle. You can always share another harvest later.' : ''"
    confirm-label="Remove"
    danger
    @confirm="executeRemove"
    @cancel="removeTarget = null"
  />
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Sprout, MessageCircle, Trash2 } from 'lucide-vue-next'
import ConfirmDialog from '../ConfirmDialog.vue'
import WatersReceivedBanner from './WatersReceivedBanner.vue'
import TogetherThisWeek from './TogetherThisWeek.vue'
import WhosTendingToday from './WhosTendingToday.vue'
import HarvestCard from './HarvestCard.vue'
import ReactionBar from './ReactionBar.vue'
import WaterButton from './WaterButton.vue'

const social = inject('social')
const { feed } = social

const removeTarget = ref(null)

const summaryItems = computed(() => feed.value.filter((i) => i.kind === 'summary'))
const nonSummaryItems = computed(() => feed.value.filter((i) => i.kind !== 'summary'))

function openDetail(item) {
  social.openEventDetail(item)
}

function confirmRemove(item) {
  removeTarget.value = item
}

async function executeRemove() {
  if (removeTarget.value) await social.deleteDispatch(removeTarget.value.id)
  removeTarget.value = null
}

function fmtDuration(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

function relDay(dateStr) {
  if (!dateStr) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((today - d) / 86400000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>
