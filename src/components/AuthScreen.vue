<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-1">Garten</h1>
        <p class="text-sm text-gray-500 mb-6">Sign in to cultivate your garden</p>

        <form @submit.prevent="handleSubmit" class="space-y-3">
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            minlength="6"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <p v-if="message" class="text-sm text-green-600">{{ message }}</p>
          <button
            type="submit"
            :disabled="submitting"
            class="w-full py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {{ submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In' }}
          </button>
        </form>

        <p class="mt-4 text-sm text-center text-gray-500">
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <button
            @click="isSignUp = !isSignUp; error = ''; message = ''"
            class="text-green-600 hover:underline font-medium ml-1"
          >
            {{ isSignUp ? 'Sign In' : 'Sign Up' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'

const email = ref('')
const password = ref('')
const isSignUp = ref(false)
const submitting = ref(false)
const error = ref('')
const message = ref('')

const { signIn, signUp } = inject('auth')

const handleSubmit = async () => {
  error.value = ''
  message.value = ''
  submitting.value = true
  const fn = isSignUp.value ? signUp : signIn
  const { error: err } = await fn(email.value, password.value)
  if (err) {
    error.value = err.message
  } else if (isSignUp.value) {
    message.value = 'Check your email for the confirmation link.'
  }
  submitting.value = false
}
</script>
