import { ref, shallowRef } from 'vue'
import type { EffectCard, Equip, Hero, Keyword, Lineup, Lord, RushLineup, Talent } from '@/types/data'
import { groupCpTalents, type CpGroup } from './cp'
import { loadGameData, loadHuyaLineups, loadRushLineups, type GameData } from './loader'

export type CardKind = 'hero' | 'equip' | 'talent' | 'effect' | 'lord'

export const KIND_LABEL: Record<CardKind, string> = {
  hero: '英雄',
  equip: '装备',
  talent: '天赋',
  effect: '效果牌',
  lord: '棋手',
}

export interface Db extends GameData {
  heroById: Map<number, Hero>
  equipById: Map<number, Equip>
  talentById: Map<number, Talent>
  effectById: Map<number, EffectCard>
  lordById: Map<number, Lord>
  keywordByName: Map<string, Keyword>
  /** hero id -> CP talents that include this hero */
  cpByHero: Map<number, Talent[]>
  /** CP talents grouped by hero pair */
  cpGroups: CpGroup[]
  lineupByKey: Map<string, Lineup>
  /** 钻石狂潮 lineups (with their opening packs); empty until loaded in the background */
  rush: RushLineup[]
  rushById: Map<string, RushLineup>
}

type Status = 'loading' | 'ready' | 'error'

const db = shallowRef<Db | null>(null)
const status = ref<Status>('loading')
const error = ref('')

/**
 * Lineups are reactive so views update when Huya's lineups arrive in the background:
 * `db.lineups` / `db.lineupByKey` are getters over these refs.
 */
let officialLineups: Lineup[] = []
const lineups = shallowRef<Lineup[]>([])
const lineupByKey = shallowRef(new Map<string, Lineup>())
const huyaStatus = ref<Status>('loading')

function setLineups(list: Lineup[]) {
  lineups.value = list
  lineupByKey.value = new Map(list.map((l) => [l.key, l]))
}

/** 钻石狂潮 data, reactive for the same reason as the lineups above. */
const rush = shallowRef<RushLineup[]>([])
const rushById = shallowRef(new Map<string, RushLineup>())
const rushStatus = ref<Status>('loading')

function setRush(list: RushLineup[]) {
  rush.value = list
  rushById.value = new Map(list.map((l) => [l.id, l]))
}

const byId = <T extends { id: number }>(list: T[]) => new Map(list.map((x) => [x.id, x]))

function buildDb({ lineups: official, ...data }: GameData): Db {
  officialLineups = official
  setLineups(official)
  setRush([])
  const cpByHero = new Map<number, Talent[]>()
  for (const t of data.talents) {
    for (const hid of t.cp?.heroes ?? []) {
      const list = cpByHero.get(hid) ?? []
      list.push(t)
      cpByHero.set(hid, list)
    }
  }
  return {
    ...data,
    get lineups() {
      return lineups.value
    },
    get lineupByKey() {
      return lineupByKey.value
    },
    get rush() {
      return rush.value
    },
    get rushById() {
      return rushById.value
    },
    heroById: byId(data.heroes),
    equipById: byId(data.equips),
    talentById: byId(data.talents),
    effectById: byId(data.effects),
    lordById: byId(data.lords),
    keywordByName: new Map(data.keywords.map((k) => [k.name, k])),
    cpByHero,
    cpGroups: groupCpTalents(data.talents),
  }
}

export async function initData(): Promise<void> {
  status.value = 'loading'
  error.value = ''
  try {
    db.value = buildDb(await loadGameData())
    status.value = 'ready'
    void loadHuya()
    void loadRush()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
}

/** Append Huya's lineups after the official ones. The app works without them. */
export async function loadHuya(): Promise<void> {
  const d = db.value
  if (!d) return
  huyaStatus.value = 'loading'
  try {
    const extra = await loadHuyaLineups(d.meta)
    if (db.value !== d) return // data was reloaded meanwhile
    setLineups([...officialLineups, ...extra])
    huyaStatus.value = 'ready'
  } catch {
    if (db.value === d) huyaStatus.value = 'error'
  }
}

/** Load the 钻石狂潮 lineups. The rest of the app works without them. */
export async function loadRush(): Promise<void> {
  const d = db.value
  if (!d) return
  rushStatus.value = 'loading'
  try {
    const list = await loadRushLineups(d.meta)
    if (db.value !== d) return // data was reloaded meanwhile
    setRush(list)
    rushStatus.value = 'ready'
  } catch {
    if (db.value === d) rushStatus.value = 'error'
  }
}

export function useDataStatus() {
  return { status, error, huyaStatus, rushStatus }
}

/** False while Huya's lineups are still loading, i.e. a missing lineup key may still turn up. */
export const lineupsComplete = () => huyaStatus.value !== 'loading'

/** Same for 钻石狂潮 lineups. */
export const rushComplete = () => rushStatus.value !== 'loading'

/** Access the loaded data. Views are only mounted after data is ready. */
export function useDb(): Db {
  if (!db.value) throw new Error('Data not loaded yet')
  return db.value
}

/** Look up a card of any kind; returns its display name and icon. */
export function cardBrief(kind: CardKind, id: number): { name: string; icon: string } | null {
  const d = db.value
  if (!d) return null
  switch (kind) {
    case 'hero': {
      const h = d.heroById.get(id)
      return h ? { name: h.name, icon: h.avatar } : null
    }
    case 'equip': {
      const e = d.equipById.get(id)
      return e ? { name: e.name, icon: e.icon } : null
    }
    case 'talent': {
      const t = d.talentById.get(id)
      return t ? { name: t.name, icon: t.icon } : null
    }
    case 'effect': {
      const e = d.effectById.get(id)
      return e ? { name: e.name, icon: e.icon } : null
    }
    case 'lord': {
      const l = d.lordById.get(id)
      return l ? { name: l.name, icon: l.avatar } : null
    }
  }
}
