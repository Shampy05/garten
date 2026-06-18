<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="close"></div>
      <div class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-line w-full max-w-lg z-10 max-h-[85vh] sm:max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-stone-100">
          <h3 class="gp-title">Dispatch</h3>
          <button @click="close" class="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors">
            <X :size="18" />
          </button>
        </div>

        <!-- Dispatch body -->
        <div class="p-4 overflow-y-auto">
          <div class="flex items-start gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
              :class="event.isSelf ? 'bg-stone-100 text-stone-500' : 'bg-garden-50 text-garden-700'"
            >
              {{ event.actorName[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-stone-700 leading-snug">
                <span class="font-medium">{{ event.isSelf ? 'You' : event.actorName }}</span>

                <template v-if="event.kind === 'session'">
                  tended
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: event.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ event.language_name || 'a language' }}</span>
                  </span>
                  for {{ fmtDuration(event.minutes) }}<span v-if="event.activity_type" class="text-stone-400"> · {{ event.activity_type }}</span>
                </template>

                <template v-else-if="event.kind === 'milestone'">
                  reached a <span class="font-medium text-orange-500">{{ event.streak_days }}-day streak</span> in
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: event.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ event.language_name || 'a language' }}</span>
                  </span>
                </template>

                <template v-else-if="event.kind === 'circle_report'">
                  shared a weekly report of <span class="font-medium">{{ fmtDuration(event.minutes) }}</span>
                  <span v-if="event.language_name"> — mostly {{ event.language_name }}</span>
                </template>

                <template v-else-if="event.kind === 'commitment_progress'">
                  <template v-if="event.details?.milestone === 100">
                    hit their weekly commitment for
                  </template>
                  <template v-else>
                    reached {{ event.details?.milestone }}% of their commitment for
                  </template>
                  <span class="inline-flex items-center gap-1 align-baseline">
                    <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: event.language_color || '#9ca3af' }"></span>
                    <span class="font-medium">{{ event.language_name || 'a language' }}</span>
                  </span>
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
              <div class="text-xs text-stone-400 mt-1">{{ relDay(event.occurred_on) }}</div>
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
            <h4 class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Garden notes</h4>
            <div v-if="comments.length === 0" class="text-center py-6 text-stone-400 text-sm">
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
                  :class="c.author_id === userId.value ? 'bg-stone-100 text-stone-500' : 'bg-garden-50 text-garden-700'"
                >
                  {{ c.authorName[0].toUpperCase() }}
                </div>
                <div class="min-w-0 flex-1 bg-stone-50 rounded-lg px-3 py-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-medium text-stone-700">{{ c.author_id === userId.value ? 'You' : c.authorName }}</span>
                    <button
                      v-if="c.author_id === userId.value"
                      @click="removeComment(c.id)"
                      class="text-stone-300 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                  <p class="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{{ c.body }}</p>
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
                class="gp-input flex-1 min-w-0"
              />
              <button
                @click="postComment"
                :disabled="!commentBody.trim()"
                class="gp-btn-primary px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
