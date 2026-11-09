/** CP talents grouped by hero pair. Some pairs have several talents (e.g. 貂蝉 + 上官婉儿). */
import type { Talent } from '@/types/data'
import { bestSource } from './lineupQuery'
import type { Db } from './store'

export interface CpGroup {
  /** "smallerId-largerId" */
  key: string
  heroes: [number, number]
  talents: Talent[]
}

export interface CpStats {
  /** lineups that use both heroes */
  both: number
  /** talent id -> lineups that recommend this talent */
  byTalent: Map<number, number>
}

export function groupCpTalents(talents: Talent[]): CpGroup[] {
  const groups = new Map<string, CpGroup>()
  for (const t of talents) {
    if (!t.cp) continue
    const [a, b] = t.cp.heroes
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    const g = groups.get(key)
    if (g) g.talents.push(t)
    else groups.set(key, { key, heroes: [a, b], talents: [t] })
  }
  for (const g of groups.values()) g.talents.sort((x, y) => y.quality - x.quality || x.id - y.id)
  return [...groups.values()]
}

export function cpStats(db: Db, g: CpGroup): CpStats {
  return {
    both: bestSource(db, { heroes: g.heroes }).count,
    byTalent: new Map(g.talents.map((t) => [t.id, bestSource(db, { talents: [t.id] }).count])),
  }
}
