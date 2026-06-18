<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm animate-grow-in">
      <div class="gp-card shadow-hero p-6 sm:p-8">
        <SproutIcon class="w-12 h-12 mb-3 animate-sway" />
        <h1 class="font-display text-3xl font-bold text-stone-900 mb-1 tracking-tight">Garten</h1>
        <p class="text-sm text-stone-500 mb-6">
          {{ view === 'reset' ? 'Reset your password' : 'Sign in to cultivate your garden' }}
        </p>

        <!-- Reset Password View -->
        <form v-if="view === 'reset'" @submit.prevent="handleReset" class="space-y-3">
          <input
            v-model="resetEmail"
            type="email"
            placeholder="Email"
            required
            class="gp-input"
          />
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <p v-if="message" class="text-sm text-garden-600">{{ message }}</p>
          <button
            type="submit"
            :disabled="submitting"
            class="gp-btn-primary w-full py-2.5 text-sm"
          >
            {{ submitting ? 'Please wait…' : 'Send Reset Link' }}
          </button>
        </form>
        <p v-if="view === 'reset'" class="mt-4 text-sm text-center text-stone-500">
          <button
            @click="view = 'auth'; error = ''; message = ''"
            class="text-garden-600 hover:text-garden-700 hover:underline font-medium"
          >
            Back to Sign In
          </button>
        </p>

        <!-- Sign In / Sign Up View -->
        <form v-else @submit.prevent="handleSubmit" class="space-y-3">
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            class="gp-input"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            minlength="6"
            class="gp-input"
          />
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <p v-if="message" class="text-sm text-garden-600">{{ message }}</p>
          <button
            type="submit"
            :disabled="submitting"
            class="gp-btn-primary w-full py-2.5 text-sm"
          >
            {{ submitting ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In' }}
          </button>
        </form>
        <p v-if="!isSignUp && view !== 'reset'" class="mt-3 text-sm text-center">
          <button
            @click="view = 'reset'; error = ''; message = ''"
            class="text-stone-400 hover:text-stone-600"
          >
            Forgot password?
          </button>
        </p>

        <p v-if="view !== 'reset'" class="mt-4 text-sm text-center text-stone-500">
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <button
            @click="isSignUp = !isSignUp; error = ''; message = ''"
            class="text-garden-600 hover:text-garden-700 hover:underline font-medium ml-1"
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
import SproutIcon from './SproutIcon.vue'

const email = ref('')
const password = ref('')
const resetEmail = ref('')
const isSignUp = ref(false)
const submitting = ref(false)
const error = ref('')
const message = ref('')
const view = ref('auth')

const { signIn, signUp, resetPassword } = inject('auth')

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

const handleReset = async () => {
  error.value = ''
  message.value = ''
  submitting.value = true
  const { error: err } = await resetPassword(resetEmail.value)
  if (err) {
    error.value = err.message
  } else {
    message.value = 'Check your email for the reset link.'
  }
  submitting.value = false
}
</script>
