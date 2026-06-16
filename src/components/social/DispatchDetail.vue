<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="close"></div>
      <div class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg z-10 max-h-[85vh] sm:max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 class="font-display font-semibold text-gray-800">Dispatch</h3>
          <button @click="close" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X :size="18" />
          </button>
        </div>

        <!-- Dispatch body -->
        <div class="p-4 overflow-y-auto">
          <div class="flex items-start gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
              :class="event.isSelf ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'"
            >
              {{ event.actorName[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-700 leading-snug">
                <span class="font-medium">{{ event.isSelf ? 'You' : event.actorName }}</span>

                <template v-if="event.kind === 'session'">
                  tended
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: event.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ event.language_name || 'a language' }}</span>
                  </span>
                  for {{ fmtDuration(event.minutes) }}<span v-if="event.activity_type" class="text-gray-400"> · {{ event.activity_type }}</span>
                </template>

                <template v-else-if="event.kind === 'milestone'">
                  reached a <span class="font-medium text-orange-500">{{ event.streak_days }}-day streak</span> in
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: event.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ event.language_name || 'a language' }}</span>
                  </span>
                </template>

                <template v-else-if="event.kind === 'summary'">
                  shared a weekly harvest of <span class="font-medium">{{ fmtDuration(event.minutes) }}</span>
                  <span v-if="event.language_name"> — mostly {{ event.language_name }}</span>
                </template>

                <template v-else-if="event.kind === 'bloom'">
                  and <span class="font-medium">{{ event.coActorIsSelf ? 'you' : event.coActorName }}</span>
                  cross-pollinated
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: event.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ event.language_name || 'a language' }}</span>
                  </span>
                </template>
              </p>
              <div class="text-xs text-gray-400 mt-1">{{ relDay(event.occurred_on) }}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-4 mt-4">
            <WaterButton
              v-if="!event.isSelf"
              :recipient-id="event.actor_id"
              :name="event.actorName"
              compact
            />
            <ReactionBar :event-id="event.id" @toggle="toggle" />
          </div>

          <!-- Comments -->
          <div class="mt-6">
            <h4 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Garden notes</h4>
            <div v-if="comments.length === 0" class="text-center py-6 text-gray-400 text-sm">
              No notes yet. Be the first to leave one.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="c in comments"
                :key="c.id"
                class="flex items-start gap-2.5"
              >
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  :class="c.author_id === userId.value ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'"
                >
                  {{ c.authorName[0].toUpperCase() }}
                </div>
                <div class="min-w-0 flex-1 bg-gray-50 rounded-lg px-3 py-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-medium text-gray-700">{{ c.author_id === userId.value ? 'You' : c.authorName }}</span>
                    <button
                      v-if="c.author_id === userId.value"
                      @click="removeComment(c.id)"
                      class="text-gray-300 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                  <p class="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{{ c.body }}</p>
                </div>
              </div>
            </div>

            <!-- Add comment -->
            <div class="mt-3 flex items-start gap-2">
              <input
                v-model="commentBody"
                @keydown.enter.prevent="postComment"
                type="text"
                placeholder="Leave a garden note..."
                class="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                @click="postComment"
                :disabled="!commentBody.trim()"
                class="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { X, Trash2 } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth.js'
import WaterButton from './WaterButton.vue'
import ReactionBar from './ReactionBar.vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const social = inject('social')
const { userId } = useAuth()
const { selectedEvent, commentsByEvent, toggleReaction, addComment, deleteComment } = social

const commentBody = ref('')

const event = computed(() => selectedEvent.value)
const comments = computed(() => commentsByEvent.value[event.value?.id] || [])

function close() {
  commentBody.value = ''
  emit('close')
}

async function toggle(kind) {
  await toggleReaction(event.value.id, kind)
}

async function postComment() {
  const body = commentBody.value.trim()
  if (!body) return
  await addComment(event.value.id, body)
  commentBody.value = ''
}

async function removeComment(id) {
  await deleteComment(id)
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

watch(() => props.visible, (v) => {
  if (v) commentBody.value = ''
})
</script>
