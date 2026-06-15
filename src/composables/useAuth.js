import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

// Shared session state for the whole app. These refs live at module scope so
// every useAuth() / useStorage() consumer reads the same source of truth.
const user = ref(null)
const loading = ref(true)
const userId = computed(() => user.value?.id ?? null)

// Single app-wide auth listener. Registered exactly once at module load and
// intentionally kept for the lifetime of the app, so there is only ever one
// subscription regardless of how many components mount.
supabase.auth.onAuthStateChange((_event, session) => {
  user.value = session?.user ?? null
  loading.value = false
})

export function useAuth() {
  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email, password) => {
    return supabase.auth.signUp({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
  }

  return { user, userId, loading, signIn, signUp, signOut, resetPassword }
}
