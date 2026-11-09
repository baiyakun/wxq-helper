import { ref } from 'vue'

/** Minimal global toast: one message at a time. */
export const toast = ref<{ id: number; text: string } | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export function showToast(text: string, ms = 2800): void {
  clearTimeout(timer)
  toast.value = { id: ++seq, text }
  timer = setTimeout(() => (toast.value = null), ms)
}
