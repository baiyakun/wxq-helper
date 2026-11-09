/**
 * Sync official 王者万象棋 data from Tencent's public CDN and write
 * normalized JSON files into public/data/.
 *
 * Usage: npm run sync
 *
 * Sources (discovered from the official site wxq.qq.com scripts):
 *   cards:   589094_oscard_new_{bit}.js   bit: 1 hero, 2 effect, 4 equip, 8 talent, 16 lord
 *   lineups: 598252_oslineupbyrecommend_pro_{page}.js, 600264_oslineupbyhot_pro_{page}.js,
 *            600269_oslineupbybeginner_pro_{page}.js
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CampName,
  CoreRole,
  CpInfo,
  DataMeta,
  EffectCard,
  Equip,
  Hero,
  Keyword,
  Lineup,
  LineupSource,
  Lord,
  MiniCard,
  LordSlot,
  Talent,
} from '../src/types/data.ts'
import { CAMPS, DATA_FILES } from '../src/types/data.ts'

const CDN = 'https://game.gtimg.cn/images/amside/ide_timer/'
const CARD_URL = (bit: number) => `${CDN}589094_oscard_new_${bit}.js`
const LINEUP_URL: Record<LineupSource, (page: number) => string> = {
  recommend: (p) => `${CDN}598252_oslineupbyrecommend_pro_${p}.js`,
  hot: (p) => `${CDN}600264_oslineupbyhot_pro_${p}.js`,
  beginner: (p) => `${CDN}600269_oslineupbybeginner_pro_${p}.js`,
}
const CARD_BITS = { hero: 1, effect: 2, equip: 4, talent: 8, lord: 16 } as const
const MAX_LINEUP_PAGES = 80
const FETCH_TIMEOUT_MS = 30_000
const FETCH_RETRIES = 3
const USER_AGENT = 'wxq-helper-sync/0.1 (personal research)'
const OUT_DIR = path.resolve(import.meta.dirname, '../public/data')

/** Minimum counts; anything lower means the source changed shape and we must not publish. */
const MIN_COUNTS = { heroes: 50, equips: 30, talents: 100, effects: 30, lords: 10, lineups: 50, cpTalents: 5 }

/** Short names used in talent descriptions that differ from the hero card name. */
const HERO_ALIASES: Record<string, string> = { 婉儿: '上官婉儿' }

// ---------------------------------------------------------------------------
// Raw (official) shapes – only the fields we read. Everything is optional
// because the source is not under our control.
// ---------------------------------------------------------------------------

interface RawCard {
  id: number
  name: string
  type?: number
  quality?: number
  thumb?: string
  image?: string
  cardImage?: string
  desc?: string
  previewCardIDs?: number[]
  previewCards?: RawCard[]
  sourceCards?: RawCard[]
  relationName?: string
  shopBuyCost?: { Count?: number }
  talentStageType?: number
  talentStageDesc?: string
  heroCard?: RawHeroCard | null
  equipCard?: { atlasSubTypeName?: string; equipTypeName?: string } | null
  talentCard?: { grpName?: string } | null
  effectCard?: { grpName?: string } | null
}

interface RawHeroCard {
  labels?: string[]
  awakeingCard?: RawCard | null
  keywordDescription?: { name: string; desc: string }[]
  skillList?: {
    name: string
    desc: string
    icon?: string
    enhanceSkill?: { params?: { level: number; desc: string }[] }
  }[]
  properties?: Record<string, number>
}

interface RawLord {
  lordId: number
  name: string
  avatar?: string
  portrait?: string
  talent?: { name: string; level?: number; cards?: RawCard[] }[]
}

interface RawCardFile {
  heroCards?: RawCard[]
  effectCards?: RawCard[]
  equipCards?: RawCard[]
  talentCards?: RawCard[]
  lords?: RawLord[]
}

interface RawLineupHero {
  id?: number | string
  positionX?: number
  positionZ?: number
  type?: number
  isEvo?: boolean
  equipList?: { id: number | string }[]
}

interface RawLineup {
  key: string | number
  name?: string
  tags?: string[]
  lordList?: { id: number | string; desc?: string }[]
  heroList?: RawLineupHero[]
  author?: { name?: string } | null
  createTimestamp?: number | string
  useNum?: number
  interactiveData?: { score?: string | number; scoreNum?: number; likeNum?: number } | null
  brief?: string
  positionDesc?: string
  equipDesc?: string
  talentCardDesc?: string
  effectCardDesc?: string
  talentCardList?: { id: number | string }[]
  effectCardList?: { id: number | string }[]
  operationDetails?: {
    beginRound?: number
    endRound?: number
    mainHeroList?: { id: number | string }[]
    subHeroList?: { id: number | string }[]
    desc?: string
  }[]
  seasonId?: number | string
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

interface Fetched<T> {
  data: T
  lastModified: Date | null
}

let newestSourceDate: Date | null = null

async function fetchJson<T>(url: string): Promise<Fetched<T> | null> {
  let lastError: unknown
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const lm = res.headers.get('last-modified')
      const lastModified = lm ? new Date(lm) : null
      if (lastModified && (!newestSourceDate || lastModified > newestSourceDate)) newestSourceDate = lastModified
      return { data: (await res.json()) as T, lastModified }
    } catch (err) {
      lastError = err
      if (attempt < FETCH_RETRIES) await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  throw new Error(`Failed to fetch ${url}: ${String(lastError)}`)
}

async function fetchCards<K extends keyof RawCardFile>(bit: number, key: K): Promise<NonNullable<RawCardFile[K]>> {
  const res = await fetchJson<RawCardFile>(CARD_URL(bit))
  const list = res?.data[key]
  if (!Array.isArray(list)) throw new Error(`Card file ${bit} has no "${key}" array`)
  return list as NonNullable<RawCardFile[K]>
}

async function fetchLineupList(source: LineupSource): Promise<RawLineup[]> {
  const all: RawLineup[] = []
  for (let page = 1; page <= MAX_LINEUP_PAGES; page++) {
    const res = await fetchJson<RawLineup[]>(LINEUP_URL[source](page))
    if (!res || !Array.isArray(res.data) || res.data.length === 0) break
    all.push(...res.data)
  }
  return all
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const stripTags = (s: string) => s.replace(/<[^<>]*>/g, '')
const stripMarkers = (s: string) => s.replace(/\{\{|\}\}|\[\[|\]\]/g, '')

/** Convert the game's Unity-style rich text into our {{highlight}} / [[keyword]] markers. */
export function richText(input: string | null | undefined): string {
  if (!input) return ''
  let s = stripMarkers(input.replace(/\r\n?/g, '\n'))
  s = s.replace(/<a(?:\s[^>]*)?>([\s\S]*?)<\/a>/g, (_m, inner: string) => {
    const t = stripTags(inner).trim()
    return t ? `[[${t}]]` : ''
  })
  const highlight = (_m: string, inner: string) => {
    if (/^\[\[[^\]]+\]\]$/.test(inner.trim())) return inner
    const t = stripMarkers(stripTags(inner))
    return t.trim() ? `{{${t}}}` : t
  }
  // Resolve innermost tags first until nothing changes (handles <color><b>..</b></color> and vice versa).
  let prev: string
  do {
    prev = s
    s = s
      .replace(/<color=[^>]*>((?:(?!<color=)[\s\S])*?)<\/color>/g, highlight)
      .replace(/<b>((?:(?!<b>)[\s\S])*?)<\/b>/g, highlight)
  } while (s !== prev)
  return stripTags(s).trim()
}

const plainText = (s: string) => stripMarkers(s)

/** Only allow https URLs; upgrade http. Anything else becomes empty. */
function safeUrl(u: string | null | undefined): string {
  if (!u) return ''
  if (u.startsWith('https://')) return u
  if (u.startsWith('http://')) return `https://${u.slice('http://'.length)}`
  if (u.startsWith('//')) return `https:${u}`
  return ''
}

const toNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

const isCamp = (s: string | undefined): s is CampName => !!s && (CAMPS as readonly string[]).includes(s)

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normHero(c: RawCard): Hero {
  const hc = c.heroCard
  if (!hc) throw new Error(`Hero ${c.id} has no heroCard`)
  const p = hc.properties ?? {}
  const sk = hc.skillList?.[0]
  return {
    id: c.id,
    name: c.name,
    quality: toNum(c.quality),
    camp: isCamp(c.relationName) ? c.relationName : '无阵营',
    avatar: safeUrl(c.thumb),
    card: safeUrl(c.cardImage || c.image),
    labels: hc.labels ?? [],
    desc: richText(c.desc),
    awakenDesc: richText(hc.awakeingCard?.desc),
    skill: {
      name: sk?.name ?? '',
      desc: richText(sk?.desc),
      icon: safeUrl(sk?.icon),
      enhance: (sk?.enhanceSkill?.params ?? []).map((e) => ({ level: toNum(e.level), desc: richText(e.desc) })),
    },
    keywords: (hc.keywordDescription ?? []).map((k) => k.name),
    stats: {
      hp: toNum(p.HP),
      atk: toNum(p.phyAttack),
      ap: toNum(p.magAttack),
      def: toNum(p.phyDefense),
      mdef: toNum(p.magDefense),
      aspd: toNum(p.attackSpeed),
      crit: toNum(p.criticalRate),
      critDmg: toNum(p.criticalEffect),
      energy: toNum(p.energy),
      initEnergy: toNum(p.initEnergy),
      move: toNum(p.moveSpeed),
      range: toNum(p.attackDistance),
    },
    related: (c.previewCards ?? []).map(normMiniCard),
  }
}

function collectKeywords(raw: RawCard[]): Keyword[] {
  const map = new Map<string, Keyword>()
  for (const c of raw) {
    for (const k of c.heroCard?.keywordDescription ?? []) {
      if (!map.has(k.name)) map.set(k.name, { name: k.name, desc: richText(k.desc) })
    }
  }
  return [...map.values()]
}

function normEquip(c: RawCard): Equip {
  return {
    id: c.id,
    name: c.name,
    quality: toNum(c.quality),
    icon: safeUrl(c.thumb || c.image),
    sub: c.equipCard?.atlasSubTypeName ?? '',
    kind: c.equipCard?.equipTypeName ?? '',
    desc: richText(c.desc),
    from: (c.sourceCards ?? []).map((s) => s.id),
    to: c.previewCardIDs ?? [],
  }
}

/** Heroes the official data links to a card: its preview cards that are heroes. */
function linkedHeroes(c: RawCard, heroIds: { has(id: number): boolean }): number[] {
  return [...new Set((c.previewCardIDs ?? []).filter((id) => heroIds.has(id)))]
}

/** A pair talent: officially linked to exactly 2 heroes (e.g. 帝临), or one that mentions "共战". */
function detectCp(c: RawCard, desc: string, linked: number[], heroIdByName: Map<string, number>): CpInfo | undefined {
  const text = plainText(desc)
  const at = text.indexOf('共战')
  if (linked.length !== 2 && at < 0) return undefined
  let ids = linked
  if (ids.length !== 2) {
    // Fall back to matching hero names that appear before "共战"
    const head = text.slice(0, at)
    const names = [...heroIdByName.keys(), ...Object.keys(HERO_ALIASES)].sort((a, b) => b.length - a.length)
    const found: { pos: number; id: number }[] = []
    let rest = head
    for (const n of names) {
      const pos = rest.indexOf(n)
      if (pos < 0) continue
      const id = heroIdByName.get(HERO_ALIASES[n] ?? n)
      if (id !== undefined && !found.some((f) => f.id === id)) found.push({ pos, id })
      rest = rest.slice(0, pos) + '\u0000'.repeat(n.length) + rest.slice(pos + n.length)
    }
    ids = found.sort((a, b) => a.pos - b.pos).map((f) => f.id)
  }
  if (ids.length !== 2) {
    console.warn(`  ! CP talent "${c.name}" (${c.id}): expected 2 heroes, found ${ids.length}`)
    return undefined
  }
  return { heroes: [ids[0], ids[1]], grantsCards: /获得1张.+?和1张/.test(text) }
}

function normTalent(c: RawCard, heroById: Map<number, Hero>, heroIdByName: Map<string, number>, lordByTalent: Map<number, number>): Talent {
  const desc = richText(c.desc)
  const linked = linkedHeroes(c, heroById)
  const cp = detectCp(c, desc, linked, heroIdByName)
  const heroes = linked.length ? linked : cp ? [...cp.heroes] : []
  const text = plainText(desc)
  const t: Talent = {
    id: c.id,
    name: c.name,
    quality: toNum(c.quality),
    icon: safeUrl(c.thumb || c.image),
    desc,
    stage: c.talentStageDesc ?? '',
    stageNo: toNum(c.talentStageType),
    pack: c.talentCard?.grpName ?? '',
    heroes,
    // e.g. "获得1张亚瑟" / "获得3能量以及1张李信"
    grantsHeroes: heroes.length > 0 && heroes.every((id) => text.includes(`1张${heroById.get(id)?.name ?? ''}`)),
  }
  if (cp) t.cp = cp
  const lordId = lordByTalent.get(c.id)
  if (lordId !== undefined) t.lordId = lordId
  return t
}

function normEffect(c: RawCard): EffectCard {
  return {
    id: c.id,
    name: c.name,
    quality: toNum(c.quality),
    icon: safeUrl(c.thumb || c.image),
    camp: c.relationName ?? '',
    pack: c.effectCard?.grpName ?? '',
    cost: toNum(c.shopBuyCost?.Count),
    desc: richText(c.desc),
  }
}

function normMiniCard(c: RawCard): MiniCard {
  return { id: c.id, name: c.name, icon: safeUrl(c.thumb || c.image), desc: richText(c.desc) }
}

function normLord(l: RawLord): Lord {
  const slot = (...names: string[]): LordSlot | null => {
    const s = l.talent?.find((t) => names.includes(t.name))
    const main = s?.cards?.[0]
    if (!s || !main) return null
    return { ...normMiniCard(main), level: toNum(s.level, 1), cards: (main.previewCards ?? []).map(normMiniCard) }
  }
  return {
    id: l.lordId,
    name: l.name,
    avatar: safeUrl(l.avatar),
    portrait: safeUrl(l.portrait),
    skill: slot('技能'),
    secret: slot('秘技'),
    exclusive: slot('专属', '天赋'),
  }
}

function lineupCamps(heroIds: number[], heroById: Map<number, Hero>): CampName[] {
  const count = new Map<CampName, number>()
  for (const id of heroIds) {
    const camp = heroById.get(id)?.camp
    if (camp && camp !== '无阵营') count.set(camp, (count.get(camp) ?? 0) + 1)
  }
  const sorted = [...count.entries()].sort((a, b) => b[1] - a[1])
  // A camp counts when it has 3+ heroes; otherwise fall back to the largest camp with 2+ heroes.
  const camps = sorted.filter(([, n]) => n >= 3).map(([c]) => c)
  if (camps.length) return camps
  const top = sorted[0]
  return top && top[1] >= 2 ? [top[0]] : ['无阵营']
}

/**
 * Official lineups carry "MM-DD" without a year (sometimes a unix timestamp).
 * Infer the year: a date later than tomorrow must belong to last year.
 */
function parseCreatedAt(v: number | string | undefined, now = new Date()): number {
  if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : v
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(v ?? '')
  if (!m) return toNum(v)
  const month = Number(m[1]) - 1
  const day = Number(m[2])
  let d = new Date(Date.UTC(now.getUTCFullYear(), month, day))
  if (d.getTime() > now.getTime() + 86_400_000) d = new Date(Date.UTC(now.getUTCFullYear() - 1, month, day))
  return Math.floor(d.getTime() / 1000)
}

const ids = (list: { id: number | string }[] | undefined) => (list ?? []).map((x) => toNum(x.id)).filter((n) => n > 0)

function normLineup(r: RawLineup, heroById: Map<number, Hero>): Lineup {
  const heroes = (r.heroList ?? [])
    .filter((h) => toNum(h.id) > 0)
    .map((h) => ({
      id: toNum(h.id),
      x: toNum(h.positionX),
      z: toNum(h.positionZ),
      core: ([0, 1, 2, 3].includes(toNum(h.type)) ? toNum(h.type) : 0) as CoreRole,
      awakened: !!h.isEvo,
      equips: ids(h.equipList),
    }))
  const lordTips: Record<number, string> = {}
  for (const l of r.lordList ?? []) {
    const tip = richText(l.desc)
    if (tip) lordTips[toNum(l.id)] = tip
  }
  return {
    key: String(r.key),
    name: r.name ?? '',
    sources: [],
    rank: {},
    tags: (r.tags ?? []).filter(Boolean),
    lords: ids(r.lordList),
    lordTips,
    heroes,
    camps: lineupCamps(heroes.map((h) => h.id), heroById),
    talents: ids(r.talentCardList),
    effects: ids(r.effectCardList),
    author: r.author?.name ?? '',
    createdAt: parseCreatedAt(r.createTimestamp),
    uses: toNum(r.useNum),
    score: toNum(r.interactiveData?.score),
    scoreNum: toNum(r.interactiveData?.scoreNum),
    likes: toNum(r.interactiveData?.likeNum),
    brief: richText(r.brief),
    positionDesc: richText(r.positionDesc),
    equipDesc: richText(r.equipDesc),
    talentDesc: richText(r.talentCardDesc),
    effectDesc: richText(r.effectCardDesc),
    stages: (r.operationDetails ?? []).map((o) => ({
      from: toNum(o.beginRound),
      to: toNum(o.endRound),
      main: ids(o.mainHeroList),
      sub: ids(o.subHeroList),
      desc: richText(o.desc),
    })),
    season: toNum(r.seasonId),
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now()
  console.log('Fetching card data...')
  const [rawHeroes, rawEffects, rawEquips, rawTalents, rawLords] = await Promise.all([
    fetchCards(CARD_BITS.hero, 'heroCards'),
    fetchCards(CARD_BITS.effect, 'effectCards'),
    fetchCards(CARD_BITS.equip, 'equipCards'),
    fetchCards(CARD_BITS.talent, 'talentCards'),
    fetchCards(CARD_BITS.lord, 'lords'),
  ])

  const heroes = rawHeroes.map(normHero)
  const heroById = new Map(heroes.map((h) => [h.id, h]))
  const heroIdByName = new Map(heroes.map((h) => [h.name, h.id]))
  const heroIds = new Set(heroById.keys())
  const keywords = collectKeywords(rawHeroes)
  const equips = rawEquips.map(normEquip)
  const effects = rawEffects.map(normEffect)
  const lords = rawLords.map(normLord)
  const lordByTalent = new Map<number, number>()
  for (const l of lords) if (l.exclusive) lordByTalent.set(l.exclusive.id, l.id)
  const talents = rawTalents.map((c) => normTalent(c, heroById, heroIdByName, lordByTalent))

  console.log('Fetching lineups...')
  const lineupMap = new Map<string, Lineup>()
  for (const source of ['recommend', 'hot', 'beginner'] as const) {
    const list = await fetchLineupList(source)
    console.log(`  ${source}: ${list.length}`)
    list.forEach((raw, i) => {
      const key = String(raw.key)
      const existing = lineupMap.get(key) ?? normLineup(raw, heroById)
      if (!existing.sources.includes(source)) existing.sources.push(source)
      existing.rank[source] ??= i + 1
      lineupMap.set(key, existing)
    })
  }
  const lineups = [...lineupMap.values()]

  // Referential integrity report (warn only; the official data occasionally lags)
  const known = new Set<number>([...heroIds, ...equips.map((e) => e.id), ...talents.map((t) => t.id), ...effects.map((e) => e.id)])
  const unknown = new Set<number>()
  for (const l of lineups) {
    for (const h of l.heroes) [h.id, ...h.equips].forEach((id) => known.has(id) || unknown.add(id))
    ;[...l.talents, ...l.effects].forEach((id) => known.has(id) || unknown.add(id))
  }
  if (unknown.size) console.warn(`  ! ${unknown.size} card ids referenced by lineups are not in card data`)

  const counts: DataMeta['counts'] = {
    heroes: heroes.length,
    equips: equips.length,
    talents: talents.length,
    effects: effects.length,
    lords: lords.length,
    lineups: lineups.length,
    cpTalents: talents.filter((t) => t.cp).length,
  }
  for (const [k, min] of Object.entries(MIN_COUNTS)) {
    const n = counts[k as keyof typeof counts]
    if (n < min) throw new Error(`Sanity check failed: ${k}=${n} < ${min}. Source format may have changed; aborting.`)
  }

  const files: Record<string, unknown> = {
    [DATA_FILES.heroes]: heroes,
    [DATA_FILES.equips]: equips,
    [DATA_FILES.talents]: talents,
    [DATA_FILES.effects]: effects,
    [DATA_FILES.lords]: lords,
    [DATA_FILES.lineups]: lineups,
    [DATA_FILES.keywords]: keywords,
  }
  const serialized = Object.entries(files).map(([name, data]) => [name, JSON.stringify(data)] as const)
  const hash = createHash('sha256')
  for (const [name, body] of serialized) hash.update(name).update(body)

  const meta: DataMeta = {
    updatedAt: new Date().toISOString(),
    sourceModifiedAt: (newestSourceDate ?? new Date()).toISOString(),
    hash: hash.digest('hex').slice(0, 12),
    counts,
  }

  await mkdir(OUT_DIR, { recursive: true })
  for (const [name, body] of serialized) await writeFile(path.join(OUT_DIR, name), body)
  await writeFile(path.join(OUT_DIR, DATA_FILES.meta), JSON.stringify(meta, null, 2))

  const total = serialized.reduce((n, [, b]) => n + Buffer.byteLength(b), 0)
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s →`, counts, `${(total / 1024).toFixed(0)} KB, hash ${meta.hash}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
