import { ref, watch, type Ref } from 'vue'

const PREFIX = 'wxq:'

type StorageKind = 'local' | 'session'

function storage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

/** Same JSON "shape" check so stale or tampered values fall back to the default. */
function sameShape(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') {
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    return Object.keys(bo).every((k) => k in ao && sameShape(ao[k], bo[k]))
  }
  return true
}

/**
 * A ref persisted to localStorage (or sessionStorage). Storage failures (private mode,
 * blocked storage) are ignored and the ref simply behaves as in-memory state.
 */
export function usePersistentRef<T>(key: string, initial: T, kind: StorageKind = 'local'): Ref<T> {
  const store = storage(kind)
  let value = initial
  try {
    const raw = store?.getItem(PREFIX + key)
    if (raw !== null && raw !== undefined) {
      const parsed: unknown = JSON.parse(raw)
      if (sameShape(parsed, initial)) value = parsed as T
    }
  } catch {
    // ignore corrupt values
  }
  const r = ref(value) as Ref<T>
  watch(
    r,
    (v) => {
      try {
        store?.setItem(PREFIX + key, JSON.stringify(v))
      } catch {
        // ignore quota / access errors
      }
    },
    { deep: true },
  )
  return r
}
