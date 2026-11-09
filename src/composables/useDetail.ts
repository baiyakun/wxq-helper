import { computed } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import type { CardKind } from '@/data/store'

/**
 * Card detail panel state lives in the URL (?card=hero-1541) so that:
 * - the system back gesture closes the panel / returns to the previous card
 * - a detail view can be shared or reloaded
 */

export interface DetailRef {
  kind: CardKind
  id: number
}

const CARD_RE = /^(hero|equip|talent|effect|lord)-(\d+)$/

export function parseCardParam(v: unknown): DetailRef | null {
  if (typeof v !== 'string') return null
  const m = CARD_RE.exec(v)
  if (!m) return null
  return { kind: m[1] as CardKind, id: Number(m[2]) }
}

/** History position before the first card of the current chain was opened. */
let basePosition: number | null = null

const historyPosition = (): number | null => {
  const pos: unknown = window.history.state?.position
  return typeof pos === 'number' ? pos : null
}

function withoutCard(query: LocationQuery): LocationQuery {
  const rest = { ...query }
  delete rest.card
  return rest
}

export function useDetail() {
  const route = useRoute()
  const router = useRouter()
  const current = computed(() => parseCardParam(route.query.card))

  function open(kind: CardKind, id: number) {
    if (current.value?.kind === kind && current.value.id === id) return
    if (!current.value) basePosition = historyPosition()
    void router.push({ query: { ...route.query, card: `${kind}-${id}` } })
  }

  function close() {
    const pos = historyPosition()
    const base = basePosition
    basePosition = null
    if (base !== null && pos !== null && pos > base) {
      router.go(base - pos)
    } else {
      void router.replace({ query: withoutCard(route.query) })
    }
  }

  return { current, open, close }
}
