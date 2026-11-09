import { ref, shallowRef } from 'vue'
import type { EffectCard, Equip, Hero, Keyword, Lineup, Lord, Talent } from '@/types/data'
import { groupCpTalents, type CpGroup } from './cp'
import { loadGameData, type GameData } from './loader'

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
}

type Status = 'loading' | 'ready' | 'error'

const db = shallowRef<Db | null>(null)
const status = ref<Status>('loading')
const error = ref('')

const byId = <T extends { id: number }>(list: T[]) => new Map(list.map((x) => [x.id, x]))

function buildDb(data: GameData): Db {
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
    heroById: byId(data.heroes),
    equipById: byId(data.equips),
    talentById: byId(data.talents),
    effectById: byId(data.effects),
    lordById: byId(data.lords),
    keywordByName: new Map(data.keywords.map((k) => [k.name, k])),
    cpByHero,
    cpGroups: groupCpTalents(data.talents),
    lineupByKey: new Map(data.lineups.map((l) => [l.key, l])),
  }
}

export async function initData(): Promise<void> {
  status.value = 'loading'
  error.value = ''
  try {
    db.value = buildDb(await loadGameData())
    status.value = 'ready'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
}

export function useDataStatus() {
  return { status, error }
}

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
