<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 max-w-md mx-auto mt-4">
    <SproutIcon class="w-9 h-9 mb-3" />
    <h2 class="font-display text-2xl font-bold text-gray-900">Open your garden gate</h2>
    <p class="text-sm text-gray-500 mt-1 mb-6 leading-relaxed">
      Choose a username so friends can find you. Until you do, you stay completely private —
      no one can see you or your garden.
    </p>

    <form @submit.prevent="submit" class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Username</label>
        <div class="flex items-center rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent overflow-hidden">
          <span class="pl-3 text-gray-400 text-sm">@</span>
          <input
            v-model="username"
            type="text"
            placeholder="meadow_fox"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            class="flex-1 px-2 py-2 text-sm focus:outline-none"
            @input="onInput"
          />
        </div>
        <p class="text-[11px] text-gray-400 mt-1">3–20 characters · lowercase letters, numbers, underscores.</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Display name <span class="text-gray-300 font-normal">(optional)</span>
        </label>
        <input
          v-model="displayName"
          type="text"
          placeholder="Pax"
          maxlength="40"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting || !valid"
        class="w-full py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {{ submitting ? 'Planting…' : 'Join the garden' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, inject, computed } from 'vue'
import SproutIcon from '../SproutIcon.vue'

const social = inject('social')
const username = ref('')
const displayName = ref('')
const error = ref('')
const submitting = ref(false)

const valid = computed(() => /^[a-z0-9_]{3,20}$/.test(username.value))

function onInput() {
  // Keep the handle clean as they type: lowercase, allowed chars only.
  username.value = username.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

async function submit() {
  if (!valid.value || submitting.value) return
  error.value = ''
  submitting.value = true
  const { error: err } = await social.createProfile(username.value, displayName.value)
  submitting.value = false
  if (err) error.value = err
}
</script>
