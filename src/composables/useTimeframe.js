import { ref } from 'vue'

export function useTimeframe() {
  const viewMode = ref('month')
  const viewDate = ref(new Date())

  const updateViewMode = (mode) => {
    viewMode.value = mode
    viewDate.value = new Date()
  }

  const navigateView = (direction) => {
    const d = new Date(viewDate.value)
    switch (viewMode.value) {
      case 'month':
        d.setMonth(d.getMonth() + direction)
        break
      case 'quarter':
        d.setMonth(d.getMonth() + direction * 3)
        break
      case 'year':
        d.setFullYear(d.getFullYear() + direction)
        break
    }
    viewDate.value = d
  }

  return { viewMode, viewDate, updateViewMode, navigateView }
}
