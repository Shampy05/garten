import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'

const user = ref(null)
const loading = ref(true)

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

  return { user, loading, signIn, signUp, signOut }
}
