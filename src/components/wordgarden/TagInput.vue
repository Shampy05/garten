<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="(tag, i) in modelValue"
      :key="`${tag}-${i}`"
      class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-garden-50 text-garden-700 border border-garden-100"
    >
      {{ tag }}
      <button
        type="button"
        @click="remove(i)"
        :aria-label="`Remove tag ${tag}`"
        class="p-0.5 rounded-full hover:bg-garden-100 text-garden-600 hover:text-garden-800 transition-colors"
      >
        <X :size="10" />
      </button>
    </span>
    <input
      v-model="draft"
      type="text"
      :placeholder="modelValue.length ? 'add another…' : placeholder"
      class="flex-1 min-w-[6rem] text-sm bg-transparent border-none outline-none placeholder:text-stone-400"
      maxlength="30"
      @keydown.enter.prevent="commit"
      @keydown.,.prevent="commit"
      @blur="commit"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'e.g. kitchen, trip to Berlin' },
  max: { type: Number, default: 8 }, // mirrors chk_vocab_tags_count
})

const emit = defineEmits(['update:modelValue'])

const draft = ref('')

// Commits on Enter, comma, or blur (so a half-typed tag isn't silently lost
// when the user clicks away) — trimmed, case-insensitively deduped against
// what's already there, capped at `max` so the pill row can't grow forever.
function commit() {
  const value = draft.value.trim().replace(/,+$/, '').trim()
  draft.value = ''
  if (!value || props.modelValue.length >= props.max) return
  const exists = props.modelValue.some((t) => t.toLowerCase() === value.toLowerCase())
  if (exists) return
  emit('update:modelValue', [...props.modelValue, value])
}

function remove(index) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>
