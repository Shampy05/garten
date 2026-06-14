import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'error', duration = 4000) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function error(message, duration) {
    show(message, 'error', duration)
  }

  function success(message, duration) {
    show(message, 'success', duration)
  }

  return { toasts, show, dismiss, error, success }
}
