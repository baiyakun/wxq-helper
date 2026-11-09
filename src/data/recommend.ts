/**
 * Lineup recommendation: scores every official lineup against the player's lord,
 * preferred camps, owned heroes and hero-linked talents. Only the criteria the user filled in are counted.
 */
import type { CoreRole, Lineup, LineupHero, Talent } from '@/types/data'
import type { CpGroup } from './cp'
import type { Db } from './store'

export interface RecommendInput {
  /** 0 = not chosen */
  lord: number
  camps: string[]
  heroes: number[]
  /** hero-linked talents (Talent.heroes not empty) */
  talents: number[]
}

/** Hero weight by official core marker: carry 3, tank / utility 2, others 1. */
export const CORE_WEIGHT: Record<CoreRole, number> = { 0: 1, 1: 3, 2: 2, 3: 2 }

/** Share of the match score per criterion (percent of the filled-in criteria). */
export const MATCH_WEIGHTS = { heroes: 60, talents: 40, lord: 25, camps: 15 } as const

export interface CpHint {
  group: CpGroup
  /** pair heroes the user does not own yet (empty when no heroes were entered) */
  missing: number[]
}

export interface Recommendation {
  lineup: Lineup
  /** 0-100, rounded */
  match: number
  lordMatch: boolean
  /** preferred camps this lineup belongs to */
  campMatch: string[]
  /** selected talents whose heroes are in this lineup */
  talentMatch: Talent[]
  owned: LineupHero[]
  /** heroes still needed, core heroes first */
  missing: LineupHero[]
  /** CP pairs fully inside this lineup */
  cps: CpHint[]
}

export const hasInput = (i: RecommendInput) =>
  i.lord > 0 || i.camps.length > 0 || i.heroes.length > 0 || i.talents.length > 0

/**
 * A lineup fits a talent when it has the talent's heroes: all of them for 1-2 linked heroes,
 * any one for 3+ (those list examples of a hero trait, e.g. summoners).
 */
export function fitsTalent(l: Lineup, t: Talent): boolean {
  const has = (id: number) => l.heroes.some((h) => h.id === id)
  if (!t.heroes.length) return false
  return t.heroes.length <= 2 ? t.heroes.every(has) : t.heroes.some(has)
}

const weightOf = (heroes: LineupHero[]) => heroes.reduce((n, h) => n + CORE_WEIGHT[h.core], 0)
/** Carry, tank, utility, then the rest */
const CORE_ORDER: Record<CoreRole, number> = { 1: 0, 2: 1, 3: 2, 0: 3 }

export function recommend(db: Db, input: RecommendInput): Recommendation[] {
  if (!hasInput(input)) return []
  const talents = input.talents.map((id) => db.talentById.get(id)).filter((t) => t !== undefined)
  const useHeroes = input.heroes.length > 0
  const useTalents = talents.length > 0
  const useLord = input.lord > 0
  const useCamps = input.camps.length > 0
  // Heroes handed out by the chosen talents (e.g. "获得1张亚瑟") count as owned.
  const owned = new Set([...input.heroes, ...talents.filter((t) => t.grantsHeroes).flatMap((t) => t.heroes)])
  const active =
    (useHeroes ? MATCH_WEIGHTS.heroes : 0) +
    (useTalents ? MATCH_WEIGHTS.talents : 0) +
    (useLord ? MATCH_WEIGHTS.lord : 0) +
    (useCamps ? MATCH_WEIGHTS.camps : 0)

  const out: Recommendation[] = []
  for (const l of db.lineups) {
    const have = l.heroes.filter((h) => owned.has(h.id))
    const lordMatch = useLord && l.lords.includes(input.lord)
    const campMatch = useCamps ? l.camps.filter((c) => input.camps.includes(c)) : []
    const talentMatch = talents.filter((t) => fitsTalent(l, t))

    let raw = 0
    if (useHeroes) raw += (MATCH_WEIGHTS.heroes * weightOf(have)) / Math.max(1, weightOf(l.heroes))
    if (useTalents) raw += (MATCH_WEIGHTS.talents * talentMatch.length) / talents.length
    if (lordMatch) raw += MATCH_WEIGHTS.lord
    if (campMatch.length) raw += MATCH_WEIGHTS.camps
    if (raw <= 0) continue

    const ids = new Set(l.heroes.map((h) => h.id))
    out.push({
      lineup: l,
      match: Math.round((raw / active) * 100),
      lordMatch,
      campMatch,
      talentMatch,
      owned: have,
      missing: useHeroes
        ? l.heroes.filter((h) => !owned.has(h.id)).sort((a, b) => CORE_ORDER[a.core] - CORE_ORDER[b.core])
        : [],
      cps: db.cpGroups
        .filter((g) => g.heroes.every((id) => ids.has(id)))
        .map((group) => ({ group, missing: useHeroes ? group.heroes.filter((id) => !owned.has(id)) : [] })),
    })
  }
  // Higher match first; popularity breaks ties.
  return out.sort((a, b) => b.match - a.match || b.lineup.uses - a.lineup.uses)
}
