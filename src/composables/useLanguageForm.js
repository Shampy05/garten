import { ref, computed } from 'vue'
import { randomColor } from '../lib/color.js'

export function useLanguageForm(existingNames) {
  const selectedLanguage = ref(null)
  const color = ref(randomColor())
  const selectedTypes = ref(['reading'])
  const autocompleteRef = ref(null)

  function onLanguageSelect(name) {
    selectedLanguage.value = name
  }

  function toggleType(type) {
    const i = selectedTypes.value.indexOf(type)
    if (i === -1) {
      selectedTypes.value.push(type)
    } else if (selectedTypes.value.length > 1) {
      selectedTypes.value.splice(i, 1)
    }
  }

  function getLanguageData() {
    if (!selectedLanguage.value) return null
    return {
      name: selectedLanguage.value,
      color: color.value,
      types: [...selectedTypes.value]
    }
  }

  function reset() {
    selectedLanguage.value = null
    color.value = randomColor()
    selectedTypes.value = ['reading']
    autocompleteRef.value?.clear()
  }

  return {
    selectedLanguage,
    color,
    selectedTypes,
    autocompleteRef,
    onLanguageSelect,
    toggleType,
    getLanguageData,
    reset
  }
}
