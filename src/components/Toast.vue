<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto max-w-sm px-4 py-3 rounded-xl shadow-card border text-sm font-medium flex items-center gap-2.5 animate-slideUp"
        :class="toast.type === 'error'
          ? 'bg-red-50 text-red-700 border-red-200'
          : toast.type === 'celebrate'
            ? 'bg-garden-50 text-garden-800 border-garden-300 ring-1 ring-garden-200/60'
            : 'bg-garden-50 text-garden-700 border-garden-200'"
      >
        <CircleAlert v-if="toast.type === 'error'" class="w-4 h-4 flex-shrink-0" />
        <Sprout v-else-if="toast.type === 'celebrate'" class="w-4 h-4 flex-shrink-0 animate-sway" />
        <Check v-else class="w-4 h-4 flex-shrink-0" />
        <span class="flex-1">{{ toast.message }}</span>
        <button @click="dismiss(toast.id)" class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { CircleAlert, Check, X, Sprout } from 'lucide-vue-next'
import { useToast } from '../composables/useToast.js'

const { toasts, dismiss } = useToast()
</script>

<style scoped>
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slideUp {
  animation: slideUp 0.2s ease-out;
}
</style>
