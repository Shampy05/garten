<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
    <h3 class="font-display text-lg font-semibold text-gray-800 mb-3">Garden circle</h3>

    <div v-if="friends.length === 0" class="text-center py-8 text-gray-400">
      <Sprout :size="28" class="mx-auto mb-2 text-gray-300" />
      <p class="text-sm">No friends yet.</p>
      <p class="text-xs mt-1">Find gardeners below to grow your circle.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="f in friends"
        :key="f.friendship_id"
        class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group"
      >
        <div class="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-display font-bold flex-shrink-0">
          {{ (f.display_name || f.username)[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-gray-700 truncate">{{ f.display_name || f.username }}</span>
            <span
              v-if="f.current_streak > 0"
              class="text-xs font-medium text-orange-500 flex-shrink-0"
              :title="f.current_streak + ' day streak'"
            >
              {{ f.current_streak }}d
            </span>
          </div>
          <div class="flex items-center gap-2.5 mt-1 min-w-0">
            <template v-if="f.active_languages && f.active_languages.length">
              <span v-for="lang in f.active_languages" :key="lang.name" class="inline-flex items-center gap-1 min-w-0">
                <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: lang.color }"></span>
                <span class="text-xs text-gray-500 truncate">{{ lang.name }}</span>
              </span>
            </template>
            <span v-else class="text-xs text-gray-400 italic">{{ lastActiveLabel(f) }}</span>
          </div>
        </div>
        <button
          @click="confirmRemove(f)"
          class="flex-shrink-0 text-gray-300 hover:text-red-500 p-1.5 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100"
          title="Remove friend"
        >
          <X :size="15" />
        </button>
      </div>
    </div>
  </div>

  <ConfirmDialog
    :visible="!!removeTarget"
    title="Remove friend?"
    :message="removeTarget
      ? `This removes ${removeTarget.display_name || removeTarget.username} from your garden circle. You can always reconnect later.`
      : ''"
    confirm-label="Remove"
    danger
    @confirm="executeRemove"
    @cancel="removeTarget = null"
  />
</template>

<script setup>
import { ref, inject } from 'vue'
import { Sprout, X } from 'lucide-vue-next'
import ConfirmDialog from '../ConfirmDialog.vue'

const social = inject('social')
const { friends } = social
const removeTarget = ref(null)

function confirmRemove(f) {
  removeTarget.value = f
}
function executeRemove() {
  if (removeTarget.value) social.removeFriendship(removeTarget.value.friendship_id)
  removeTarget.value = null
}

// Shown only when a friend has no activity in the last 14 days, so active
// languages are empty. Date math mirrors lib/date.js (local, day-granular).
function lastActiveLabel(f) {
  if (!f.last_active) return 'No sessions yet'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const last = new Date(f.last_active + 'T00:00:00')
  const diff = Math.round((today - last) / 86400000)
  if (diff <= 0) return 'Active today'
  if (diff === 1) return 'Active yesterday'
  if (diff < 14) return `Active ${diff}d ago`
  return 'Resting this fortnight'
}
</script>
