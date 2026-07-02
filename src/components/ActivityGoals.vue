<template>
  <div class="gp-card gp-pad">
    <div class="mb-4">
      <h3 class="gp-title text-lg">Activity goals</h3>
      <p class="text-xs text-stone-500 mt-0.5">Weekly targets per activity, across all languages.</p>
    </div>

    <div v-if="rows.length === 0" class="text-sm text-stone-400 italic flex items-center gap-2">
      <Sprout :size="18" class="text-stone-300 flex-shrink-0" />
      Add activity types to a language to set goals here.
    </div>

    <div v-else class="space-y-4">
      <div v-for="(row, i) in rows" :key="row.type">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium text-stone-700 capitalize">{{ row.type }}</span>
          <div class="flex items-center gap-1.5">
            <span v-if="row.targetHours" class="text-xs font-semibold text-stone-700 tabular-nums">
              {{ fmtHours(row.loggedMinutes) }} / {{ row.targetHours }}h
            </span>
            <button
              v-if="editingType !== row.type"
              @click="startEdit(row)"
              class="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <Pencil v-if="row.targetHours" :size="12" />
              <span v-else class="text-xs">+ Set goal</span>
            </button>
          </div>
        </div>

        <div v-if="row.targetHours" class="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
          <div
            class="h-2 rounded-full transition-all duration-500"
            :style="{ width: row.progress + '%', backgroundColor: barColor(i) }"
          ></div>
        </div>

        <div v-if="editingType === row.type" class="mt-2 flex items-center gap-2">
          <input
            v-model.number="editValue"
            type="number"
            min="0.5"
            step="0.5"
            placeholder="e.g. 3"
            class="gp-input w-24 py-1.5"
            @keydown.enter="save(row.type)"
          />
          <span class="text-xs text-stone-500">hours/week</span>
          <button @click="save(row.type)" class="text-xs text-garden-600 hover:text-garden-700 font-semibold">Save</button>
          <button @click="cancelEdit" class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
          <button
            v-if="row.targetHours"
            @click="remove(row.type)"
            class="text-xs text-red-500 hover:text-red-600 ml-auto"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Pencil, Sprout } from 'lucide-vue-next'

const props = defineProps({
  rows: { type: Array, required: true }
})

const emit = defineEmits(['set-goal', 'clear-goal'])

const editingType = ref(null)
const editValue = ref(null)

// A single garden hue at stepped opacity — distinguishes rows without
// introducing a color scheme that competes with language colors elsewhere.
const BAR_OPACITIES = [1, 0.8, 0.6, 0.45, 0.32, 0.22, 0.16]
function barColor(i) {
  return `rgba(22, 163, 74, ${BAR_OPACITIES[i] ?? 0.16})`
}

function startEdit(row) {
  editingType.value = row.type
  editValue.value = row.targetHours || null
}

function cancelEdit() {
  editingType.value = null
  editValue.value = null
}

function save(type) {
  emit('set-goal', type, editValue.value)
  cancelEdit()
}

function remove(type) {
  emit('clear-goal', type)
  cancelEdit()
}

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
