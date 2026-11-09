/** Shared lineup matching and deep links into the lineup list (handled by LineupsView). */
import type { Lineup, LineupSource } from '@/types/data'
import type { Db } from './store'

/** The official lists. Huya lineups are not counted in the codex links. */
export const LINEUP_SOURCES: readonly LineupSource[] = ['recommend', 'hot', 'beginner']

/** In at least one official list (Huya-only lineups are not). */
export const isOfficial = (l: Lineup) => l.sources.some((s) => LINEUP_SOURCES.includes(s))

export interface LineupQuery {
  heroes?: readonly number[]
  talents?: readonly number[]
}

export const hasAllHeroes = (l: Lineup, ids: readonly number[]) => ids.every((id) => l.heroes.some((h) => h.id === id))
export const hasAllTalents = (l: Lineup, ids: readonly number[]) => ids.every((id) => l.talents.includes(id))

const matches = (l: Lineup, q: LineupQuery) => hasAllHeroes(l, q.heroes ?? []) && hasAllTalents(l, q.talents ?? [])

/**
 * The official list with the most matching lineups (ties keep list order) and its match count.
 * Deep links open this list, so the count shown next to a link equals what the user sees.
 */
export function bestSource(db: Db, q: LineupQuery): { source: LineupSource; count: number } {
  let best: { source: LineupSource; count: number } = { source: 'recommend', count: 0 }
  for (const s of LINEUP_SOURCES) {
    const count = db.lineups.filter((l) => l.sources.includes(s) && matches(l, q)).length
    if (count > best.count) best = { source: s, count }
  }
  return best
}

/** Route location for the lineup list filtered by heroes and/or talents. */
export function lineupsLink(q: LineupQuery) {
  const query: Record<string, string> = {}
  if (q.heroes?.length) query.hero = q.heroes.join(',')
  if (q.talents?.length) query.talent = q.talents.join(',')
  return { path: '/lineups', query }
}

/** Parse a comma-separated id list from a route query value, keeping only known ids. */
export function parseIdList(value: unknown, known: (id: number) => boolean): number[] {
  if (value === undefined || value === null) return []
  const ids = String(value)
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && known(id))
  return [...new Set(ids)]
}
