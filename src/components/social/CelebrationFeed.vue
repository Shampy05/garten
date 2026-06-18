<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="gp-title text-lg">Celebrations</h3>
        <p class="text-xs text-stone-500 mt-0.5">Milestones, blooms, and weekly reports.</p>
      </div>
    </div>

    <div v-if="feed.length === 0" class="text-center py-8 text-stone-400">
      <Sprout :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No celebrations yet.</p>
      <p class="text-xs mt-1">Log sessions, hit commitments, or start a focus session to make some noise.</p>
    </div>

    <div v-else class="space-y-4">
      <template v-for="item in feed" :key="item.id">
        <CircleReport
          v-if="item.kind === 'circle_report'"
          :item="item"
          @open="openDetail(item)"
        />

        <div
          v-else
          class="group flex items-start gap-3 p-4 rounded-xl bg-white border border-stone-100 hover:border-stone-200 transition-colors cursor-pointer"
          @click="openDetail(item)"
        >
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
            :class="item.isSelf ? 'bg-stone-100 text-stone-500' : 'bg-garden-50 text-garden-700'"
          >
            {{ item.actorName[0].toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-stone-700 leading-snug">
              <span class="font-medium">{{ item.isSelf ? 'You' : item.actorName }}</span>

              <template v-if="item.kind === 'milestone'">
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

              <template v-else-if="item.kind === 'commitment_progress'">
                <template v-if="item.details?.milestone === 100">
                  hit their weekly commitment for
                </template>
                <template v-else>
                  reached {{ item.details?.milestone }}% of their commitment for
                </template>
                <span class="inline-flex items-center gap-1 align-baseline">
                  <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                  <span class="font-medium">{{ item.language_name || 'a language' }}</span>
                </span>
              </template>
            </p>
            <div class="text-xs text-stone-400 mt-0.5">{{ relDay(item.occurred_on) }}</div>

            <div class="flex items-center justify-between mt-3">
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
                  title="Remove celebration"
                >
                  <Trash2 :size="14" />
                </button>
                <button
                  @click.stop="openDetail(item)"
                  class="text-stone-400 hover:text-garden-600 transition-colors"
                  title="Open notes"
                >
                  <MessageCircle :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <ConfirmDialog
    :visible="!!removeTarget"
    title="Remove celebration?"
    :message="removeTarget ? 'This removes the celebration from your garden circle.' : ''"
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
import CircleReport from './CircleReport.vue'
import ReactionBar from './ReactionBar.vue'
import WaterButton from './WaterButton.vue'

const social = inject('social')
const { feed } = social

const removeTarget = ref(null)

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
