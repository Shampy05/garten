<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="$emit('cancel')"></div>
      <div class="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm z-10 p-5">
        <h3 class="text-base font-semibold text-gray-900 mb-2">{{ title }}</h3>
        <p class="text-sm text-gray-500 mb-5">{{ message }}</p>
        <div class="flex gap-2 justify-end">
          <button
            @click="$emit('cancel')"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            @click="$emit('confirm')"
            class="px-4 py-2 text-sm text-white rounded-lg transition-colors font-medium"
            :class="danger ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
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
