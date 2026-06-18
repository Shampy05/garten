<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="gp-title text-lg">Celebrations</h3>
        <p class="text-xs text-stone-500 mt-0.5">Moments worth witnessing across your circle.</p>
      </div>
    </div>

    <!-- Coming up: anticipate the next bloom. A milestone you can see
         approaching motivates every day until it lands. -->
    <div
      v-if="comingUp.length > 0"
      class="mb-4 rounded-xl border border-garden-100 bg-garden-50/50 px-3.5 py-3"
    >
      <div class="flex items-center gap-1.5 mb-2">
        <Sprout :size="13" class="text-garden-500 animate-sway" />
        <span class="text-[11px] font-semibold uppercase tracking-wider text-garden-700">Coming up</span>
      </div>
      <ul class="space-y-1.5">
        <li
          v-for="(item, i) in comingUp"
          :key="i"
          class="flex items-center gap-2 text-sm text-stone-700"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }"></span>
          <span class="leading-snug">{{ item.text }}</span>
        </li>
      </ul>
    </div>

    <div v-if="feed.length === 0" class="text-center py-8 text-stone-400">
      <Sprout :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No celebrations yet.</p>
      <p class="text-xs mt-1">Plant a new language, keep a streak, or hit a commitment to make some noise.</p>
    </div>

    <div v-else class="space-y-4">
      <template v-for="item in feed" :key="item.id">
        <!-- Quiet divider where fresh blooms give way to older ones. -->
        <div
          v-if="item.id === firstStaleId"
          class="flex items-center gap-2 pt-1"
        >
          <span class="text-[11px] font-medium uppercase tracking-wider text-stone-300">Earlier</span>
          <span class="flex-1 h-px bg-line"></span>
        </div>

        <div :class="isStale(item) ? 'opacity-60 transition-opacity hover:opacity-100' : ''">
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
              class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              :class="item.kind === 'new_language'
                ? 'bg-garden-50 text-garden-600'
                : item.isSelf ? 'bg-stone-100 text-stone-500' : 'bg-garden-50 text-garden-700'"
            >
              <Sprout v-if="item.kind === 'new_language'" :size="16" />
              <span v-else class="font-display font-bold text-sm">{{ item.actorName[0].toUpperCase() }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-stone-700 leading-snug">
                <span class="font-medium">{{ item.isSelf ? 'You' : item.actorName }}</span>

                <template v-if="item.kind === 'new_language'">
                  planted a new language:
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: item.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ item.language_name || 'a language' }}</span>
                  </span>
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

              <!-- Reactions land back: on your own blooms, name who celebrated
                   you. The witnessing is the reward, not the stat itself. -->
              <p
                v-if="item.isSelf && celebratedBy(item).length > 0"
                class="mt-1.5 inline-flex items-center gap-1 text-xs text-garden-700"
              >
                <Flower2 :size="12" class="text-garden-500" />
                {{ celebratedLabel(celebratedBy(item)) }}
              </p>

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
import { Sprout, MessageCircle, Trash2, Flower2 } from 'lucide-vue-next'
import ConfirmDialog from '../ConfirmDialog.vue'
import CircleReport from './CircleReport.vue'
import ReactionBar from './ReactionBar.vue'
import WaterButton from './WaterButton.vue'

const props = defineProps({
  // Streak milestones nearing their threshold, computed from entries upstream.
  upcomingMilestones: { type: Array, default: () => [] }
})

const social = inject('social')
const { feed, commitments, reactionsByEvent, friends } = social

const removeTarget = ref(null)

// ---------------------------------------------------------------------------
// Coming up — anticipation. Merge nearing streaks (from entries, passed in)
// with self-commitments close to completion (already in the composable), rank
// by urgency, and surface only the most imminent so the strip stays calm.
// ---------------------------------------------------------------------------
const comingUp = computed(() => {
  const items = []

  for (const m of props.upcomingMilestones) {
    items.push({
      color: m.languageColor || '#9ca3af',
      urgency: m.urgency,
      text: `${m.daysToGo === 1 ? '1 day' : `${m.daysToGo} days`} to your ${m.target}-day ${m.languageName} streak`
    })
  }

  for (const c of commitments.value || []) {
    if (!c.isSelf) continue
    const logged = Number(c.logged_minutes) || 0
    const target = Number(c.target_minutes) || 0
    if (target <= 0 || logged <= 0 || logged >= target) continue
    items.push({
      color: c.language_color || '#9ca3af',
      urgency: logged / target,
      text: `${fmtMins(target - logged)} to your ${c.language_name} commitment this week`
    })
  }

  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 2)
})

// ---------------------------------------------------------------------------
// Freshness — recent blooms read bright, older ones fade into a quiet "Earlier"
// section so the feed never feels like an undifferentiated wall.
// ---------------------------------------------------------------------------
function daysSince(dateStr) {
  if (!dateStr) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((today - d) / 86400000)
}

function isStale(item) {
  return daysSince(item.occurred_on) > 7
}

const firstStaleId = computed(() => {
  const stale = feed.value.find((e) => isStale(e))
  // No divider if everything is fresh, or everything is stale (nothing to split).
  if (!stale) return null
  if (feed.value.every((e) => isStale(e))) return null
  return stale.id
})

// ---------------------------------------------------------------------------
// Reactions land back — resolve who reacted to one of your own celebrations.
// Only friends can react (RLS), so the friends list names them.
// ---------------------------------------------------------------------------
function celebratedBy(item) {
  if (!item.isSelf) return []
  const myId = social.profile?.value?.id
  const list = reactionsByEvent.value[item.id] || []
  const ids = [...new Set(list.map((r) => r.reactor_id))].filter((id) => id && id !== myId)
  return ids.map((id) => {
    const f = (friends.value || []).find((fr) => fr.friend_id === id)
    return f ? f.display_name || f.username : 'A gardener'
  })
}

function celebratedLabel(names) {
  if (names.length === 1) return `${names[0]} celebrated this`
  if (names.length === 2) return `${names[0]} & ${names[1]} celebrated this`
  return `${names[0]}, ${names[1]} + ${names.length - 2} more celebrated this`
}

function fmtMins(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

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
  const diff = daysSince(dateStr)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>
