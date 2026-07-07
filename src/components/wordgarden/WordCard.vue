<template>
  <div class="gp-card p-3">
    <!-- Display state -->
    <div v-if="!editing" class="flex items-start gap-3">
      <div class="pt-0.5">
        <VocabStageGlyph :stage="growth" :color="languageColor" :size="20" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="text-sm font-semibold text-stone-800">{{ word.term }}</span>
          <span class="text-sm text-stone-500 min-w-0">{{ word.meaning }}</span>
        </div>
        <p v-if="word.note" class="text-xs text-stone-400 mt-0.5 line-clamp-2">{{ word.note }}</p>
        <p v-if="sourceTitle" class="text-[11px] text-stone-400 mt-0.5 italic">from {{ sourceTitle }}</p>
      </div>
      <span
        v-if="due"
        class="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-garden-700 bg-garden-50 border border-garden-100 px-2 py-0.5 rounded-full"
      >
        Due
      </span>
      <div class="flex items-center flex-shrink-0">
        <button
          @click="startEdit"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil :size="13" />
        </button>
        <button
          @click="$emit('remove', word)"
          class="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove"
          aria-label="Remove"
        >
          <Trash2 :size="13" />
        </button>
      </div>
    </div>

    <!-- Inline edit state -->
    <div v-else class="space-y-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input v-model="draft.term" type="text" class="gp-input text-sm" placeholder="Word or phrase" />
        <input v-model="draft.meaning" type="text" class="gp-input text-sm" placeholder="Meaning" />
      </div>
      <input v-model="draft.note" type="text" class="gp-input text-sm" placeholder="Context or example (optional)" />
      <div class="flex items-center gap-2">
        <button
          @click="saveEdit"
          :disabled="!draft.term.trim() || !draft.meaning.trim()"
          class="gp-btn-primary px-3 py-1.5 text-xs"
        >
          Save
        </button>
        <button @click="editing = false" class="gp-btn-ghost px-3 py-1.5 text-xs">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { vocabGrowthStage, isDue } from '../../lib/srs.js'
import VocabStageGlyph from './VocabStageGlyph.vue'

const props = defineProps({
  word: { type: Object, required: true },
  languageColor: { type: String, default: null },
  // Resolved by the parent against saved books; null when the source book is
  // gone (soft reference) or the word was planted by hand.
  sourceTitle: { type: String, default: null },
})

const emit = defineEmits(['update', 'remove'])

const growth = computed(() => vocabGrowthStage(props.word))
const due = computed(() => isDue(props.word))

const editing = ref(false)
const draft = ref({ term: '', meaning: '', note: '' })

function startEdit() {
  draft.value = {
    term: props.word.term,
    meaning: props.word.meaning,
    note: props.word.note || '',
  }
  editing.value = true
}

function saveEdit() {
  emit('update', {
    id: props.word.id,
    updates: {
      term: draft.value.term.trim(),
      meaning: draft.value.meaning.trim(),
      note: draft.value.note.trim() || null,
    },
  })
  editing.value = false
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
