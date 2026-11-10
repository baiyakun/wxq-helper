/**
 * Name search with Chinese, full pinyin and pinyin initials (e.g. "hml" -> 花木兰).
 * pinyin-pro is loaded lazily on first use to keep the initial bundle small.
 */
import { ref } from 'vue'
import { categoryLabel, mainHero } from './rush'
import type { CardKind, Db } from './store'

/** `rush`: a 钻石狂潮 lineup / opening pack */
export type SearchKind = CardKind | 'lineup' | 'rush'

export interface SearchEntry {
  kind: SearchKind
  /** card id; 0 for lineups */
  id: number
  /** lineup key, or the 钻石狂潮 lineup id (lineups only) */
  key?: string
  name: string
  icon: string
  /** secondary text shown in results, e.g. camp or grade */
  sub: string
  full: string
  initials: string
}

export interface SearchHit {
  entry: SearchEntry
  score: number
}

let pinyinFn: typeof import('pinyin-pro').pinyin | null = null
/** Reactive flag so computed lists re-run once pinyin support has loaded. */
const pinyinReady = ref(false)

async function getPinyin() {
  if (!pinyinFn) {
    pinyinFn = (await import('pinyin-pro')).pinyin
    pinyinReady.value = true
  }
  return pinyinFn
}

/** Normalize user input: lower-case, drop spaces and apostrophes. */
export const normalizeQuery = (q: string) => q.toLowerCase().replace(/[\s'’]/g, '')

export async function buildIndex(db: Db): Promise<SearchEntry[]> {
  const pinyin = await getPinyin()
  const make = (kind: SearchKind, id: number, name: string, icon: string, sub: string, key?: string): SearchEntry => ({
    kind,
    id,
    key,
    name,
    icon,
    sub,
    full: pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').toLowerCase(),
    initials: pinyin(name, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' })
      .join('')
      .toLowerCase(),
  })
  return [
    ...db.heroes.map((h) => make('hero', h.id, h.name, h.avatar, `${h.camp} · ${h.quality}阶`)),
    ...db.lords.map((l) => make('lord', l.id, l.name, l.avatar, '棋手')),
    ...db.equips.map((e) => make('equip', e.id, e.name, e.icon, e.sub)),
    ...db.talents.map((t) => make('talent', t.id, t.name, t.icon, t.cp ? 'CP天赋' : t.stage)),
    ...db.effects.map((e) => make('effect', e.id, e.name, e.icon, `效果牌 · ${e.camp}`)),
    ...db.lineups.map((l) => {
      const core = l.heroes.find((h) => h.core === 1) ?? l.heroes[0]
      const icon = core ? (db.heroById.get(core.id)?.avatar ?? '') : ''
      const lords = l.lords.map((id) => db.lordById.get(id)?.name).filter(Boolean).join(' / ')
      return make('lineup', 0, l.name, icon, lords || l.camps.join(' · '), l.key)
    }),
    ...db.rush.map((l) => {
      const h = mainHero(l.groups[0])
      const icon = h ? (h.id ? (db.heroById.get(h.id)?.avatar ?? '') : (h.icon ?? '')) : ''
      return make('rush', 0, l.pack?.name ?? l.name, icon, `钻石狂潮 · ${categoryLabel(l.category)} · ${l.camps.join(' / ')}`, l.id)
    }),
  ]
}

/** Score an entry against a normalized query; 0 = no match. Higher is better. */
export function scoreEntry(e: SearchEntry, q: string): number {
  if (!q) return 0
  const name = e.name.toLowerCase()
  if (name === q) return 100
  if (name.startsWith(q)) return 90
  if (name.includes(q)) return 80
  if (e.initials === q) return 75
  if (e.initials.startsWith(q)) return 70
  if (e.full.startsWith(q)) return 65
  if (e.full.includes(q)) return 50
  if (e.initials.includes(q)) return 40
  return 0
}

/** Kind priority for tie-breaking: heroes and players first. */
const KIND_RANK: Record<SearchKind, number> = { hero: 0, lord: 1, talent: 2, equip: 3, effect: 4, lineup: 5, rush: 6 }

export function search(index: SearchEntry[], query: string, limit = 40): SearchHit[] {
  const q = normalizeQuery(query)
  if (!q) return []
  const hits: SearchHit[] = []
  for (const entry of index) {
    const score = scoreEntry(entry, q)
    if (score > 0) hits.push({ entry, score })
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_RANK[a.entry.kind] - KIND_RANK[b.entry.kind] ||
      a.entry.name.length - b.entry.name.length,
  )
  return hits.slice(0, limit)
}

const pinyinCache = new Map<string, { full: string; initials: string }>()

/** Start loading pinyin support (no-op once loaded). */
export function preparePinyin(): void {
  void getPinyin()
}

/**
 * Synchronous name match for local list filters. Before pinyin has loaded it only
 * does substring matching; reading `pinyinReady` makes callers' computed re-run later.
 */
export function nameMatches(name: string, query: string): boolean {
  const q = normalizeQuery(query)
  if (!q) return true
  if (name.toLowerCase().includes(q)) return true
  if (!pinyinReady.value || !pinyinFn) return false
  let p = pinyinCache.get(name)
  if (!p) {
    p = {
      full: pinyinFn(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').toLowerCase(),
      initials: pinyinFn(name, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' })
        .join('')
        .toLowerCase(),
    }
    pinyinCache.set(name, p)
  }
  return p.initials.startsWith(q) || p.full.includes(q)
}
