<template>
  <div ref="root" class="relative flex flex-wrap items-center gap-1.5" :class="{ 'mt-2': !compact }">
    <!-- Reactions that already have at least one vote -->
    <button
      v-for="kind in activeKinds"
      :key="kind.kind"
      @click.stop="emit('toggle', kind.kind)"
      class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all"
      :class="hasReacted(kind.kind)
        ? 'bg-garden-50 border-garden-200 text-garden-700'
        : 'bg-white border-line text-stone-500 hover:border-garden-200 hover:text-garden-600'
      "
      :title="kind.label"
    >
      <component :is="kind.icon" :size="compact ? 12 : 14" stroke-width="2" />
      <span>{{ countFor(kind.kind) }}</span>
    </button>

    <!-- Single 'react' affordance — opens a labelled palette -->
    <button
      @click.stop="open = !open"
      class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all"
      :class="open
        ? 'bg-garden-50 border-garden-200 text-garden-700'
        : 'bg-white border-line text-stone-400 hover:border-garden-200 hover:text-garden-600'
      "
      :title="'Add a reaction'"
    >
      <SmilePlus :size="compact ? 13 : 15" stroke-width="2" />
      <span v-if="!compact && activeKinds.length === 0">React</span>
    </button>

    <!-- Reaction palette -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="absolute bottom-full left-0 mb-2 z-30 w-52 gp-card shadow-card p-1.5 origin-bottom-left"
      >
        <p class="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
          Send a little encouragement
        </p>
        <div class="grid grid-cols-2 gap-0.5">
          <button
            v-for="kind in REACTION_KINDS"
            :key="kind.kind"
            @click.stop="emit('toggle', kind.kind)"
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="hasReacted(kind.kind)
              ? 'bg-garden-50 text-garden-700'
              : 'text-stone-600 hover:bg-stone-50'
            "
          >
            <component :is="kind.icon" :size="15" stroke-width="2" :class="hasReacted(kind.kind) ? 'text-garden-600' : 'text-stone-400'" />
            <span class="flex-1 text-left">{{ kind.label }}</span>
            <span v-if="countFor(kind.kind) > 0" class="text-[10px] text-stone-400 tabular-nums">{{ countFor(kind.kind) }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, inject, ref, onMounted, onBeforeUnmount } from 'vue'
import { Droplets, Sun, Sprout, Leaf, Flower2, Bug, Rainbow, SmilePlus } from 'lucide-vue-next'

const props = defineProps({
  eventId: { type: String, required: true },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle'])

const social = inject('social')
const { reactionsByEvent } = social

const REACTION_KINDS = [
  { kind: 'water', label: 'Water', icon: Droplets },
  { kind: 'sun', label: 'Sunshine', icon: Sun },
  { kind: 'seed', label: 'Seed', icon: Sprout },
  { kind: 'leaf', label: 'Leaf', icon: Leaf },
  { kind: 'bloom', label: 'Bloom', icon: Flower2 },
  { kind: 'bee', label: 'Busy bee', icon: Bug },
  { kind: 'rainbow', label: 'Rainbow', icon: Rainbow }
]

const open = ref(false)
const root = ref(null)

const list = computed(() => reactionsByEvent.value[props.eventId] || [])

// Only surface reactions someone has actually given; the rest live in the palette.
const activeKinds = computed(() =>
  REACTION_KINDS.filter((k) => countFor(k.kind) > 0)
)

function countFor(kind) {
  return list.value.filter((r) => r.kind === kind).length
}

function hasReacted(kind) {
  return list.value.some((r) => r.kind === kind && r.reactor_id === social.profile?.value?.id)
}

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>
