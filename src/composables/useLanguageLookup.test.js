import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

describe('useLanguageLookup', () => {
  const languages = ref([
    { id: 'spanish', name: 'Spanish', color: '#ff0000', types: ['reading', 'speaking'] },
    { id: 'german', name: 'German', color: '#00ff00', types: ['grammar', 'vocabulary'] },
    { id: 'japanese', name: 'Japanese', color: '#0000ff', types: ['writing', 'listening'] },
  ])

  const { nameFor, colorFor, languageFor } = useLanguageLookup(languages)

  it('returns the correct name for an existing language', () => {
    expect(nameFor('spanish')).toBe('Spanish')
    expect(nameFor('german')).toBe('German')
    expect(nameFor('japanese')).toBe('Japanese')
  })

  it('returns the id as fallback for a missing language', () => {
    expect(nameFor('french')).toBe('french')
    expect(nameFor('unknown')).toBe('unknown')
  })

  it('returns the correct color for an existing language', () => {
    expect(colorFor('spanish')).toBe('#ff0000')
    expect(colorFor('german')).toBe('#00ff00')
    expect(colorFor('japanese')).toBe('#0000ff')
  })

  it('returns the default color for a missing language', () => {
    expect(colorFor('french')).toBe('#16a34a')
    expect(colorFor('unknown')).toBe('#16a34a')
  })

  it('returns the full language object for an existing language', () => {
    const lang = languageFor('spanish')
    expect(lang).toEqual({ id: 'spanish', name: 'Spanish', color: '#ff0000', types: ['reading', 'speaking'] })
  })

  it('returns null for a missing language', () => {
    expect(languageFor('french')).toBeNull()
    expect(languageFor(null)).toBeNull()
    expect(languageFor(undefined)).toBeNull()
  })

  it('updates reactively when the languages array changes', () => {
    expect(nameFor('spanish')).toBe('Spanish')

    languages.value = [
      { id: 'spanish', name: 'Español', color: '#ffff00', types: ['reading'] },
    ]

    expect(nameFor('spanish')).toBe('Español')
    expect(colorFor('spanish')).toBe('#ffff00')
  })

  it('handles an empty languages array gracefully', () => {
    languages.value = []
    expect(nameFor('spanish')).toBe('spanish')
    expect(colorFor('spanish')).toBe('#16a34a')
    expect(languageFor('spanish')).toBeNull()
  })
})
