<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div class="absolute inset-0 bg-stone-900/30 backdrop-blur-sm animate-fade-up" @click="$emit('cancel')"></div>
      <div class="relative gp-card shadow-hero w-full max-w-sm z-10 p-5 animate-grow-in">
        <h3 class="gp-title text-base mb-2 text-stone-900">{{ title }}</h3>
        <p class="text-sm text-stone-500 mb-5">{{ message }}</p>
        <div class="flex gap-2 justify-end">
          <button
            @click="$emit('cancel')"
            class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            @click="$emit('confirm')"
            class="px-4 py-2 text-sm text-white rounded-xl transition-all font-medium active:scale-[0.98]"
            :class="danger ? 'bg-red-600 hover:bg-red-700 shadow-[0_8px_20px_-10px_rgba(220,38,38,0.7)]' : 'bg-gradient-to-b from-garden-500 to-garden-600 hover:from-garden-400'"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Confirm' },
  message: { type: String, default: 'Are you sure?' },
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false }
})

defineEmits(['confirm', 'cancel'])
</script>
