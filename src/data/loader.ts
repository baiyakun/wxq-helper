import type { DataMeta, EffectCard, Equip, Hero, Keyword, Lineup, Lord, RushLineup, Talent } from '@/types/data'
import { DATA_FILES } from '@/types/data'

export interface GameData {
  meta: DataMeta
  heroes: Hero[]
  equips: Equip[]
  talents: Talent[]
  effects: EffectCard[]
  lords: Lord[]
  lineups: Lineup[]
  keywords: Keyword[]
}

const dataUrl = (file: string, version?: string) =>
  `${import.meta.env.BASE_URL}data/${file}${version ? `?v=${version}` : ''}`

async function getJson<T>(file: string, version?: string): Promise<T> {
  // meta.json is always revalidated; other files are cache-busted by the content hash.
  const res = await fetch(dataUrl(file, version), { cache: version ? 'default' : 'no-cache' })
  if (!res.ok) throw new Error(`加载 ${file} 失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

export async function loadGameData(): Promise<GameData> {
  const meta = await getJson<DataMeta>(DATA_FILES.meta)
  const v = meta.hash
  const [heroes, equips, talents, effects, lords, lineups, keywords] = await Promise.all([
    getJson<Hero[]>(DATA_FILES.heroes, v),
    getJson<Equip[]>(DATA_FILES.equips, v),
    getJson<Talent[]>(DATA_FILES.talents, v),
    getJson<EffectCard[]>(DATA_FILES.effects, v),
    getJson<Lord[]>(DATA_FILES.lords, v),
    getJson<Lineup[]>(DATA_FILES.lineups, v),
    getJson<Keyword[]>(DATA_FILES.keywords, v),
  ])
  return { meta, heroes, equips, talents, effects, lords, lineups, keywords }
}

/** Extra lineups collected by Huya; loaded after the app has started. Empty when the sync had none. */
export async function loadHuyaLineups(meta: DataMeta): Promise<Lineup[]> {
  if (!meta.counts.huyaLineups) return []
  return getJson<Lineup[]>(DATA_FILES.huyaLineups, meta.hash)
}

/** 钻石狂潮 lineups and packs from Huya; loaded after the app has started. Empty when the sync had none. */
export async function loadRushLineups(meta: DataMeta): Promise<RushLineup[]> {
  if (!meta.counts.rushLineups) return []
  return getJson<RushLineup[]>(DATA_FILES.rush, meta.hash)
}
