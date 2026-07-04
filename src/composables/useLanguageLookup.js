import { computed } from 'vue'

/**
 * Map-backed O(1) language lookup for components that repeatedly resolve
 * languageId -> name / color / full object.
 *
 * Accepts a ref/computed of the languages array (usually from useStorage).
 * Falls back gracefully when a language is missing.
 */
export function useLanguageLookup(languagesRef) {
  const map = computed(() => {
    const arr = typeof languagesRef === 'function'
      ? (languagesRef() || [])
      : (languagesRef?.value || [])
    const m = new Map()
    for (const lang of arr) {
      m.set(lang.id, lang)
    }
    return m
  })

  const nameFor = (id) => {
    const lang = map.value.get(id)
    if (!lang) return id
    // Nickname is purely cosmetic — the canonical `name` is the source of
    // truth for ids, autocomplete, and the LanguageManager add flow. Empty /
    // whitespace-only nicknames fall back to the canonical name.
    const alias = typeof lang.nickname === 'string' ? lang.nickname.trim() : ''
    return alias || lang.name
  }

  const colorFor = (id) => {
    const lang = map.value.get(id)
    return lang ? lang.color : '#16a34a'
  }

  const languageFor = (id) => {
    return map.value.get(id) || null
  }

  return { nameFor, colorFor, languageFor }
}
