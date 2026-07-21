<template>
  <!-- In select mode the wrapper intercepts every click to toggle selection.
       The WordCard inside still renders its edit/remove buttons, but they
       stay inert (display-only) because the parent <div> owns the click
       handler. We hide them visually in select mode to keep the row calm. -->
  <div
    :class="[
      'relative transition-all',
      selectMode ? 'cursor-pointer' : '',
      selected ? 'ring-2 ring-garden-500 rounded-lg' : '',
      justAdvanced ? 'animate-grow-in' : ''
    ]"
    @pointerdown="onPressStart"
    @pointerup="onPressEnd"
    @pointerleave="onPressEnd"
    @pointercancel="onPressEnd"
    @pointermove="onPressMove"
    @click="onClick"
  >
    <!-- Selection checkbox badge — only when select mode is on. Sits over
         the top-left of the row so it's the visual anchor for "this card is
         part of a selection set". The badge also stops pointer events so
         the user can click the checkbox to toggle without triggering the
         card's click handler twice. -->
    <div
      v-if="selectMode"
      class="absolute top-2 left-2 z-10 pointer-events-auto"
    >
      <button
        type="button"
        @click.stop="onToggle"
        :aria-label="selected ? `Deselect ${word.term}` : `Select ${word.term}`"
        :class="[
          'w-5 h-5 rounded-md flex items-center justify-center transition-colors border',
          selected ? 'bg-garden-600 border-garden-600 text-white' : 'bg-white/90 border-stone-300 text-transparent hover:border-garden-400'
        ]"
      >
        <Check v-if="selected" :size="12" />
      </button>
    </div>

    <WordCard
      :word="word"
      :language-color="languageColor"
      :language-code="languageCode"
      :language-name="languageName"
      :source-title="sourceTitle"
      :hide-actions="selectMode"
      :size="size"
      @update="$emit('update', $event)"
      @remove="$emit('remove', $event)"
      @filter-tag="$emit('filter-tag', $event)"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Check } from 'lucide-vue-next'
import WordCard from './WordCard.vue'

const props = defineProps({
  word: { type: Object, required: true },
  selectMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  languageColor: { type: String, default: null },
  languageCode: { type: String, default: null },
  languageName: { type: String, default: null },
  sourceTitle: { type: String, default: null },
  // Forwarded to WordCard — 'md' (default) or 'lg' (Mature deck's album row).
  size: { type: String, default: 'md' },
  // True for a word that just crossed a growth-stage glyph in the review
  // session that closed moments ago — plays a one-time grow-in flash where
  // it resurfaces (e.g. moving from "Needs water" into "Mature").
  justAdvanced: { type: Boolean, default: false },
})

const emit = defineEmits(['update', 'remove', 'toggle', 'enter-select', 'filter-tag'])

// Long-press detection: 500ms with no significant movement enters select
// mode for this card (and selects it). On touch + mouse + pen, the
// pointerdown/pointerup pair covers all three without separate handlers.
const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 8 // px of drift before a press is treated as a scroll
let pressTimer = null
let pressStartX = 0
let pressStartY = 0
let pressFired = false

function onPressStart(e) {
  if (props.selectMode) return
  // Only the primary pointer.
  if (e.button !== undefined && e.button !== 0) return
  pressStartX = e.clientX
  pressStartY = e.clientY
  pressFired = false
  pressTimer = setTimeout(() => {
    pressFired = true
    emit('enter-select', props.word)
  }, LONG_PRESS_MS)
}

function onPressEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

// Detect scroll-like motion: cancel the long-press if the pointer moves
// more than the tolerance before the timer fires.
function onPressMove(e) {
  if (!pressTimer) return
  if (Math.abs(e.clientX - pressStartX) > MOVE_TOLERANCE || Math.abs(e.clientY - pressStartY) > MOVE_TOLERANCE) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

// Click handler — in select mode, clicking the row toggles selection; in
// normal mode, this is a no-op (WordCard's own buttons handle the clicks).
function onClick(e) {
  // If the press already fired as a long-press, suppress the synthetic
  // click that follows pointerup — otherwise the click would toggle the
  // selection a second time.
  if (pressFired) {
    pressFired = false
    return
  }
  if (props.selectMode) {
    // Only fire toggle when the click target is the wrapper itself, not a
    // child element. (Children handle their own clicks via @click.stop on
    // the badge above; the rest of the card has no internal clicks in
    // select mode because the edit/remove buttons are hidden.)
    emit('toggle', props.word)
  }
}
</script>