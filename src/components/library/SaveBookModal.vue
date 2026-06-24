<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24 px-4">
      <div class="absolute inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative gp-card shadow-hero w-full max-w-md z-10 p-5 sm:p-6 space-y-5 animate-grow-in">
        <!-- Book header -->
        <div class="flex items-start gap-4 pb-4 border-b border-line">
          <div class="w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
            <img v-if="book?.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" />
            <BookOpen v-else :size="20" class="text-stone-300" />
          </div>
          <div class="min-w-0">
            <h2 class="gp-title text-base text-stone-900 leading-snug">{{ book?.title }}</h2>
            <p v-if="book?.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>
            <span class="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
              {{ nameForCode(book?.languageCode) }}
            </span>
          </div>
        </div>

        <!-- Status -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-2">Reading status</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in READING_STATUSES"
              :key="s"
              type="button"
              @click="status = s"
              class="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border"
              :class="status === s ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white border-transparent shadow-pill' : 'bg-white border-line text-stone-600 hover:border-stone-300'"
            >
              {{ STATUS_LABELS[s] }}
            </button>
          </div>
        </div>

        <!-- Rating -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-2">
            Rating <span class="text-stone-400 font-normal">(optional)</span>
          </label>
          <StarRating v-model="rating" />
        </div>

        <!-- Difficulty -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-2">
            Difficulty <span class="text-stone-400 font-normal">(optional)</span>
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in DIFFICULTIES"
              :key="d"
              type="button"
              @click="difficulty = difficulty === d ? null : d"
              class="px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all duration-200 border"
              :class="difficulty === d ? 'bg-stone-800 text-white border-transparent shadow-pill' : 'bg-white border-line text-stone-600 hover:border-stone-300'"
            >
              {{ d }}
            </button>
          </div>
        </div>

        <!-- Start date -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-1.5">Started</label>
          <input v-model="startedAt" type="date" class="gp-input" />
          <p class="text-[11px] text-stone-400 mt-1.5">Defaults to today. Change it if you began reading earlier.</p>
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-1.5">
            Notes <span class="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Vocabulary level, why you picked it, first impressions…"
            class="gp-input resize-none"
          ></textarea>
        </div>

        <div class="flex gap-3 pt-1">
          <button @click="$emit('close')" class="gp-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          <button @click="save" :disabled="!status" class="gp-btn-primary flex-1 py-2.5 text-sm">
            Save to library
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import { READING_STATUSES, STATUS_LABELS, DIFFICULTIES } from '../../lib/readingStats.js'
import { nameForCode } from '../../lib/bookLanguages.js'
import StarRating from './StarRating.vue'

const props = defineProps({
  book: { type: Object, default: null },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'close'])

const status = ref('want_to_read')
const rating = ref(null)
const difficulty = ref(null)
const notes = ref('')
const startedAt = ref(todayStr())

watch(
  () => props.visible,
  (v) => {
    if (v) {
      status.value = 'want_to_read'
      rating.value = null
      difficulty.value = null
      notes.value = ''
      startedAt.value = todayStr()
    }
  }
)

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function save() {
  if (!status.value) return
  emit('save', {
    volume: props.book,
    record: {
      targetLanguage: props.book?.languageCode,
      status: status.value,
      rating: rating.value,
      difficulty: difficulty.value,
      notes: notes.value.trim() || null,
      startedAt: startedAt.value || null,
    },
  })
}
</script>
