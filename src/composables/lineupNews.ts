import { isOfficial } from '@/data/lineupQuery'
import type { Db } from '@/data/store'
import { usePersistentRef } from './usePersistentRef'

/**
 * Detects official lineups added/removed since the user's previous session, so weekly
 * official updates are visible. Computed once per app session; Huya lineups are ignored.
 */
export interface LineupNews {
  added: Set<string>
  removed: number
  /** ms timestamp of the previous visit; 0 on first visit */
  since: number
}

const seen = usePersistentRef<{ keys: string[]; at: number }>('lineups:seen', { keys: [], at: 0 })
let session: LineupNews | null = null

export function useLineupNews(db: Db): LineupNews {
  if (session) return session
  const prev = new Set(seen.value.keys)
  const current = db.lineups.filter(isOfficial).map((l) => l.key)
  const now = new Set(current)
  session =
    prev.size === 0
      ? { added: new Set(), removed: 0, since: 0 }
      : {
          added: new Set(current.filter((k) => !prev.has(k))),
          removed: [...prev].filter((k) => !now.has(k)).length,
          since: seen.value.at,
        }
  seen.value = { keys: current, at: Date.now() }
  return session
}
