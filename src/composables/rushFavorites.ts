import { computed } from 'vue'
import { rushComplete, type Db } from '@/data/store'
import type { RushLineup } from '@/types/data'
import { usePersistentRef } from './usePersistentRef'

/**
 * Favorite 钻石狂潮 lineups, kept apart from the 万象大赛 favorites (they have no lineup code).
 * Like those, each entry carries a snapshot so a lineup Huya drops can still be viewed.
 */
interface RushFavorite {
  id: string
  savedAt: number
  snapshot: RushLineup
}

export interface ResolvedRushLineup {
  lineup: RushLineup
  /** true when the lineup is no longer in Huya's 钻石狂潮 library */
  removed: boolean
}

const stored = usePersistentRef<RushFavorite[]>('rush:favorites', [])

const isValid = (e: unknown): e is RushFavorite => {
  const x = e as Partial<RushFavorite> | null
  return !!x && typeof x.id === 'string' && typeof x.savedAt === 'number' && Array.isArray(x.snapshot?.groups)
}

const favorites = computed(() => stored.value.filter(isValid))
const favoriteIds = computed(() => new Set(favorites.value.map((f) => f.id)))

export const isRushFavorite = (id: string) => favoriteIds.value.has(id)

export function toggleRushFavorite(lineup: RushLineup): boolean {
  if (isRushFavorite(lineup.id)) {
    stored.value = favorites.value.filter((f) => f.id !== lineup.id)
    return false
  }
  stored.value = [{ id: lineup.id, savedAt: Date.now(), snapshot: lineup }, ...favorites.value]
  return true
}

/** Keep snapshots in sync with the latest data for lineups that still exist. */
export function refreshRushFavoriteSnapshots(db: Db): void {
  let changed = false
  const next = favorites.value.map((f) => {
    const fresh = db.rushById.get(f.id)
    if (fresh && fresh !== f.snapshot && JSON.stringify(fresh) !== JSON.stringify(f.snapshot)) {
      changed = true
      return { ...f, snapshot: fresh }
    }
    return f
  })
  if (changed) stored.value = next
}

export function listRushFavorites(db: Db): (ResolvedRushLineup & { savedAt: number })[] {
  return favorites.value.map((f) => {
    const fresh = db.rushById.get(f.id)
    // Not "removed" yet while the 钻石狂潮 data is still loading.
    return { lineup: fresh ?? f.snapshot, removed: !fresh && rushComplete(), savedAt: f.savedAt }
  })
}

/** Find a 钻石狂潮 lineup in the data, or in favorites if it has been removed. */
export function findRushLineup(db: Db, id: string): ResolvedRushLineup | null {
  const fresh = db.rushById.get(id)
  if (fresh) return { lineup: fresh, removed: false }
  const fav = favorites.value.find((f) => f.id === id)
  return fav ? { lineup: fav.snapshot, removed: rushComplete() } : null
}
