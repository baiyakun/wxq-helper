import { computed } from 'vue'
import { lineupsComplete, type Db } from '@/data/store'
import type { Lineup } from '@/types/data'
import { usePersistentRef } from './usePersistentRef'

/**
 * Favorite lineups with a snapshot, so a lineup removed by a season update
 * can still be viewed (flagged as removed) instead of disappearing.
 */
interface FavoriteEntry {
  key: string
  savedAt: number
  snapshot: Lineup
}

export interface ResolvedLineup {
  lineup: Lineup
  /** true when the lineup is no longer in the official lists or Huya's library */
  removed: boolean
}

const stored = usePersistentRef<FavoriteEntry[]>('favorites', [])

const isValid = (e: unknown): e is FavoriteEntry => {
  const x = e as Partial<FavoriteEntry> | null
  return !!x && typeof x.key === 'string' && typeof x.savedAt === 'number' && Array.isArray(x.snapshot?.heroes)
}

const favorites = computed(() => stored.value.filter(isValid))
const favoriteKeys = computed(() => new Set(favorites.value.map((f) => f.key)))

export const isFavorite = (key: string) => favoriteKeys.value.has(key)

export function toggleFavorite(lineup: Lineup): boolean {
  if (isFavorite(lineup.key)) {
    stored.value = favorites.value.filter((f) => f.key !== lineup.key)
    return false
  }
  stored.value = [{ key: lineup.key, savedAt: Date.now(), snapshot: lineup }, ...favorites.value]
  return true
}

/** Keep snapshots in sync with the latest official data for lineups that still exist. */
export function refreshFavoriteSnapshots(db: Db): void {
  let changed = false
  const next = favorites.value.map((f) => {
    const fresh = db.lineupByKey.get(f.key)
    if (fresh && fresh !== f.snapshot && JSON.stringify(fresh) !== JSON.stringify(f.snapshot)) {
      changed = true
      return { ...f, snapshot: fresh }
    }
    return f
  })
  if (changed) stored.value = next
}

export function listFavorites(db: Db): (ResolvedLineup & { savedAt: number })[] {
  return favorites.value.map((f) => {
    const fresh = db.lineupByKey.get(f.key)
    // Not "removed" yet while Huya's lineups are still loading.
    return { lineup: fresh ?? f.snapshot, removed: !fresh && lineupsComplete(), savedAt: f.savedAt }
  })
}

/** Find a lineup in the official data, or in favorites if it has been removed. */
export function findLineup(db: Db, key: string): ResolvedLineup | null {
  const fresh = db.lineupByKey.get(key)
  if (fresh) return { lineup: fresh, removed: false }
  const fav = favorites.value.find((f) => f.key === key)
  return fav ? { lineup: fav.snapshot, removed: lineupsComplete() } : null
}
