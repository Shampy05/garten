import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'error', duration = 4000, action = null) {
    const id = nextId++
    toasts.value.push({ id, message, type, action })
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
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

  // Success toast with a single inline action (e.g. "Undo" after a quick
  // log). Auto-dismisses after `duration` ms; clicking the action runs the
  // callback and dismisses the toast immediately so the user sees their
  // follow-up result. `duration: 0` disables the auto-dismiss — used when
  // the action itself persists beyond the toast lifetime.
  function successWithAction(message, action, duration = 5000) {
    const id = nextId++
    const dismissAfter = () => dismiss(id)
    toasts.value.push({ id, message, type: 'success', action: { ...action, onClick: () => { action.onClick(); dismissAfter() } } })
    if (duration > 0) {
      setTimeout(dismissAfter, duration)
    }
    return id
  }

  return { toasts, show, dismiss, error, success, successWithAction }
}
