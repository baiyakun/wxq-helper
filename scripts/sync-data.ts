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
 * Plus, optionally, the lineup library of Huya's 万象棋助手 (see ./huya.ts); lineups that are
 * not in the official lists go to lineups-huya.json, and its 钻石狂潮 lineups, opening packs and
 * auction picks go to rush.json. A Huya failure never blocks the sync: Huya's raw data is then read
 * from data-snapshot/ (committed; Huya refuses connections from overseas CI runners).
 *
 * `npm run snapshot` (= sync --snapshot) also refreshes data-snapshot/, and fails instead of
 * falling back when Huya is unreachable. Run it from a machine that can reach Huya, then commit.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
  LineupHero,
  LineupStats,
  Lord,
  MiniCard,
  LordSlot,
  OfficialSource,
  RushCard,
  RushCardKind,
  RushGroup,
  RushHero,
  RushLineup,
  RushPack,
  RushPick,
  RushRating,
  RushRoom,
  RushStep,
  Talent,
} from '../src/types/data.ts'
import { CAMPS, DATA_FILES } from '../src/types/data.ts'
import {
  describeError,
  fetchHuya,
  fetchHuyaRush,
  type HuyaData,
  type HuyaRushData,
  type RawHuyaHeroRef,
  type RawHuyaLineup,
  type RawHuyaStat,
  type RawRushCard,
  type RawRushGroup,
  type RawRushLineup,
} from './huya.ts'

const CDN = 'https://game.gtimg.cn/images/amside/ide_timer/'
const CARD_URL = (bit: number) => `${CDN}589094_oscard_new_${bit}.js`
const LINEUP_URL: Record<OfficialSource, (page: number) => string> = {
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
const SNAPSHOT_DIR = path.resolve(import.meta.dirname, '../data-snapshot')
const WRITE_SNAPSHOT = process.argv.includes('--snapshot')

/** Minimum counts; anything lower means the source changed shape and we must not publish. */
const MIN_COUNTS = { heroes: 50, equips: 30, talents: 100, effects: 30, lords: 10, lineups: 50, cpTalents: 5 }
/** Fewer extra Huya lineups than this means their format changed: publish without them. */
const HUYA_MIN_LINEUPS = 100
/** Same for Huya's 钻石狂潮 lineups (55 when this was written). */
const RUSH_MIN_LINEUPS = 30

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
  throw new Error(`Failed to fetch ${url}: ${describeError(lastError)}`)
}

/** How a source's raw data is stored in data-snapshot/ (JSON has no Map). */
interface SnapshotCodec<T> {
  file: string
  save(data: T): unknown
  load(json: unknown): T
}

const HUYA_SNAPSHOT: SnapshotCodec<HuyaData> = {
  file: 'huya.json',
  save: (d) => ({ lineups: d.lineups, stats: [...d.stats] }),
  load: (j) => {
    const { lineups, stats } = j as { lineups: HuyaData['lineups']; stats: [string, RawHuyaStat][] }
    return { lineups, stats: new Map(stats) }
  },
}

const RUSH_SNAPSHOT: SnapshotCodec<HuyaRushData> = {
  file: 'rush.json',
  save: (d) => ({ ...d, icons: [...d.icons] }),
  load: (j) => {
    const d = j as Omit<HuyaRushData, 'icons'> & { icons: [string, string][] }
    return { ...d, icons: new Map(d.icons) }
  },
}

/**
 * Run an optional Huya source through `use`, which must throw (before any side effect) when the
 * data looks unusable. On any failure, the raw data last saved in data-snapshot/ is used instead.
 * With --snapshot, a live result that `use` accepts is saved there, and failures are fatal.
 * Returns null when neither live nor snapshot data is usable.
 */
async function withSnapshot<T, R>(label: string, fetcher: () => Promise<T>, codec: SnapshotCodec<T>, use: (data: T) => R): Promise<R | null> {
  const file = path.join(SNAPSHOT_DIR, codec.file)
  try {
    const data = await fetcher()
    const result = use(data)
    if (WRITE_SNAPSHOT) {
      await mkdir(SNAPSHOT_DIR, { recursive: true })
      await writeFile(file, JSON.stringify({ capturedAt: new Date().toISOString(), data: codec.save(data) }))
      console.log(`  snapshot saved: data-snapshot/${codec.file}`)
    }
    return result
  } catch (err) {
    if (WRITE_SNAPSHOT) throw err
    console.warn(`  ! ${label}: ${describeError(err)}`)
  }
  let snapshot: { capturedAt?: string; data?: unknown }
  try {
    snapshot = JSON.parse(await readFile(file, 'utf8')) as typeof snapshot
  } catch (err) {
    console.warn(`  ! ${label} skipped: no usable snapshot (${describeError(err)})`)
    return null
  }
  console.warn(`  ! ${label}: falling back to the snapshot captured at ${snapshot.capturedAt ?? '?'}`)
  try {
    return use(codec.load(snapshot.data))
  } catch (err) {
    console.warn(`  ! ${label} skipped: snapshot unusable (${describeError(err)})`)
    return null
  }
}

async function fetchCards<K extends keyof RawCardFile>(bit: number, key: K): Promise<NonNullable<RawCardFile[K]>> {
  const res = await fetchJson<RawCardFile>(CARD_URL(bit))
  const list = res?.data[key]
  if (!Array.isArray(list)) throw new Error(`Card file ${bit} has no "${key}" array`)
  return list as NonNullable<RawCardFile[K]>
}

async function fetchLineupList(source: OfficialSource): Promise<RawLineup[]> {
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
// Huya lineups
// ---------------------------------------------------------------------------

/** Huya refers to cards by name; official names are unique per card type. */
interface CardIndex {
  heroById: Map<number, Hero>
  equip: Map<string, number>
  talent: Map<string, number>
  effect: Map<string, number>
  lord: Map<string, number>
}

/** Board cell "A1".."G4": column A-G → x 0-6, row 1 (front) - 4 (back) → z 3-0. */
const HUYA_CELL = /^([A-G])([1-4])$/

const idsByName = (names: (string | undefined)[] | undefined, index: Map<string, number>) =>
  (names ?? []).map((n) => index.get(n ?? '')).filter((id): id is number => id !== undefined)

function normHuyaLineup(r: RawHuyaLineup, cards: CardIndex): Lineup | null {
  const key = String(r.code).trim()
  // A few entries carry placeholder codes such as "6" that cannot be imported in game.
  if (!/^\d{5,}$/.test(key)) return null
  const g = r.groups.find((x) => x.id === r.activeGroup) ?? r.groups[0]
  if (!g) return null
  const heroRefs = (list: RawHuyaHeroRef[] | undefined) =>
    (list ?? []).map((h) => toNum(h.id)).filter((id) => cards.heroById.has(id))

  const heroes: LineupHero[] = []
  for (const u of g.units ?? []) {
    const cell = HUYA_CELL.exec(u.cell ?? '')
    const id = toNum(u.id)
    if (!cell || !cards.heroById.has(id)) continue
    heroes.push({
      id,
      x: cell[1].charCodeAt(0) - 'A'.charCodeAt(0),
      z: 4 - Number(cell[2]),
      core: ([0, 1, 2, 3].includes(toNum(u.t)) ? toNum(u.t) : 0) as CoreRole,
      awakened: !!u.evo,
      equips: idsByName(u.eq, cards.equip),
    })
  }
  if (!heroes.length) return null

  const lords: number[] = []
  const lordTips: Record<number, string> = {}
  for (const l of r.lords ?? []) {
    const id = cards.lord.get(l.name ?? '')
    if (id === undefined) continue
    lords.push(id)
    const tip = richText(l.note)
    if (tip) lordTips[id] = tip
  }

  return {
    key,
    name: r.title ?? '',
    sources: ['huya'],
    rank: {},
    // Huya's tags are snapshots ("近期飙升" from weeks ago) or its own categories: not carried over.
    tags: [],
    lords,
    lordTips,
    heroes,
    camps: lineupCamps(heroes.map((h) => h.id), cards.heroById),
    talents: idsByName(g.talentCards?.map((t) => t.name), cards.talent),
    effects: idsByName(g.effectCards?.map((t) => t.name), cards.effect),
    author: r.author ?? '',
    createdAt: parseCreatedAt(r.createTimestamp),
    uses: toNum(r.useNum),
    score: toNum(r.score),
    scoreNum: 0,
    likes: 0,
    brief: richText(r.brief || g.thought),
    positionDesc: richText(r.positionDesc),
    equipDesc: richText(r.equipDesc),
    talentDesc: richText(g.auctionAdvice),
    effectDesc: richText(g.keyItems),
    stages: (g.operations ?? []).map((o) => {
      // "回合4-11" → 4..11; a single number means a one-round stage.
      const [from = 0, to = from] = (o.roundRange?.match(/\d+/g) ?? []).map(Number)
      return { from, to, main: heroRefs(o.mainHeroes), sub: heroRefs(o.subHeroes), desc: richText(o.desc) }
    }),
    season: 0,
  }
}

function normHuyaStats(s: RawHuyaStat): LineupStats | undefined {
  const matches = toNum(s.count)
  const avgPlace = toNum(s.avgPlacement)
  if (matches <= 0 || avgPlace <= 0) return undefined
  const round = (n: number, digits: number) => Number(n.toFixed(digits))
  return { matches, avgPlace: round(avgPlace, 2), top1: round(toNum(s.firstRate), 4), top3: round(toNum(s.top3Rate), 4) }
}

/**
 * Lineups from Huya that are not in the official lists (official data wins on the same code),
 * and Huya's match stats attached to whichever lineup they belong to.
 * Optional source: live data, else the snapshot; with neither, no lineups and the official ones untouched.
 */
async function syncHuya(official: Map<string, Lineup>, cards: CardIndex): Promise<Lineup[]> {
  return (await withSnapshot('Huya', fetchHuya, HUYA_SNAPSHOT, (data) => buildHuyaLineups(data, official, cards))) ?? []
}

/** Throws before touching the official lineups when the data looks unusable. */
function buildHuyaLineups(data: HuyaData, official: Map<string, Lineup>, cards: CardIndex): Lineup[] {
  const extras = new Map<string, Lineup>()
  let skipped = 0
  for (const raw of data.lineups) {
    const key = String(raw.code).trim()
    if (official.has(key) || extras.has(key)) continue
    const l = normHuyaLineup(raw, cards)
    if (!l) {
      skipped++
      continue
    }
    l.rank.huya = extras.size + 1
    extras.set(key, l)
  }
  if (extras.size < HUYA_MIN_LINEUPS) {
    throw new Error(`only ${extras.size} usable lineups (< ${HUYA_MIN_LINEUPS}), format may have changed`)
  }

  const codeById = new Map(data.lineups.map((x) => [x.id, String(x.code).trim()]))
  let withStats = 0
  for (const [id, s] of data.stats) {
    const key = codeById.get(id) ?? ''
    const lineup = official.get(key) ?? extras.get(key)
    const stats = normHuyaStats(s)
    if (lineup && stats) {
      lineup.stats = stats
      withStats++
    }
  }
  console.log(`  huya: ${data.lineups.length} in library, ${extras.size} not in official lists, ${skipped} unusable, stats for ${withStats}`)
  return [...extras.values()]
}

// ---------------------------------------------------------------------------
// 钻石狂潮 (Huya)
// ---------------------------------------------------------------------------

const RUSH_ROOMS: readonly RushRoom[] = ['standard', 'elite', 'master']
const RUSH_GRADES = ['S', 'A', 'B', 'C', 'D']

/** Huya marks keywords with box-drawing glyphs that its font shows as icons (e.g. "╬整备"): drop them. */
const rushText = (s: string | null | undefined) =>
  stripMarkers((s ?? '').replace(/[─-╿]/g, '').replace(/\r\n?/g, '\n')).trim()

const RUSH_CORE: [RegExp, CoreRole][] = [
  [/CoreDps|输出/, 1],
  [/CoreTank|坦克/, 2],
  [/CoreFunc|功能/, 3],
]
const rushCore = (s: string | undefined): CoreRole => RUSH_CORE.find(([re]) => re.test(s ?? ''))?.[1] ?? 0

interface RushIndex {
  heroById: Map<number, Hero>
  hero: Map<string, Hero>
  equip: Map<string, Equip>
  effect: Map<string, EffectCard>
  /** Huya catalog icons by card name / id */
  icons: Map<string, string>
  /** hero names that are not in the official data (reported once at the end) */
  missing: Set<string>
}

const heroCard = (h: Hero): RushCard => ({ kind: 'hero', id: h.id, name: h.name, icon: h.avatar, desc: h.desc })

/**
 * A 钻石狂潮-only card with Huya's text. Auction and pack cards are not taken from the official
 * tables even when a name matches, because their effect differs from the 万象大赛 card.
 */
function huyaCard(kind: RushCardKind, name: string, desc: string | undefined, idx: RushIndex, huyaId?: string | number): RushCard {
  const icon = idx.icons.get(name) ?? (huyaId === undefined ? undefined : idx.icons.get(String(huyaId)))
  return { kind, id: 0, name, icon: safeUrl(icon), desc: rushText(desc) }
}

const rushSteps = (list: { label?: string; reason?: string }[] | undefined): RushStep[] =>
  (list ?? []).map((s) => ({ label: rushText(s.label), reason: rushText(s.reason) })).filter((s) => s.label)

function normRushPack(id: string, data: HuyaRushData, idx: RushIndex): RushPack | undefined {
  const p = data.packs[id]
  if (!p) return undefined
  const items = (p.contents ?? []).flatMap((c) => {
    const name = rushText(c.name)
    if (!name) return []
    const kind: RushCardKind = c.cardType === 'hero' ? 'hero' : c.cardType === 'talent' ? 'talent' : c.cardType === 'equip' ? 'equip' : 'effect'
    const hero = kind === 'hero' ? (idx.heroById.get(toNum(c.cardId)) ?? idx.hero.get(name)) : undefined
    if (kind === 'hero' && !hero) idx.missing.add(name)
    // Summaries often end with a stray "；".
    const card = hero ? heroCard(hero) : huyaCard(kind, name, c.effectSummary?.replace(/[；;]\s*$/, ''), idx, c.cardId)
    return [{ ...card, count: Math.max(1, toNum(c.count, 1)) }]
  })
  if (!items.length) return undefined

  // Effect tips are ordinary effect cards from the shared pool: link the official card when known.
  const grades = Object.keys(p.recs ?? {}).sort((a, b) => RUSH_GRADES.indexOf(a) - RUSH_GRADES.indexOf(b) || a.localeCompare(b))
  const tips = grades.flatMap((grade) =>
    (p.recs?.[grade] ?? []).flatMap((t) => {
      const name = rushText(t.name)
      if (!name) return []
      const e = idx.effect.get(name)
      const card: RushCard = e ? { kind: 'effect', id: e.id, name, icon: e.icon, desc: e.desc } : huyaCard('effect', name, t.effectSummary, idx)
      return [{ grade, card }]
    }),
  )
  const d = data.deploys[id]
  return {
    name: rushText(p.packName),
    items,
    opening: (p.opening ?? [])
      .map((o) => ({ label: [rushText(o.priority), rushText(o.name)].filter(Boolean).join(' · '), reason: rushText(o.reason) }))
      .filter((s) => s.label),
    reminder: rushText(p.mechanicReminder),
    deploy: rushSteps(d?.steps),
    deployFollowUp: rushText(d?.followUp),
    deployNote: rushText(d?.note),
    tips,
  }
}

function normRushPick(c: RawRushCard, idx: RushIndex): RushPick {
  const kind: RushCardKind = c.type === 'auction-equipment' || c.kind === '装备' ? 'equip' : 'talent'
  const text = rushText(c.attrs)
  // Talents start with their series line, e.g. "整备系列\n立即获得3张整备英雄牌。"
  const [first = '', ...rest] = text.split('\n')
  const series = kind === 'talent' && rest.length > 0 && first.endsWith('系列') ? first : ''
  return { ...huyaCard(kind, rushText(c.name), series ? rest.join('\n') : text, idx, c.id), series }
}

function normRushGroup(g: RawRushGroup, idx: RushIndex): RushGroup | null {
  const heroId = (name: string | undefined) => {
    const id = idx.hero.get(rushText(name))?.id
    if (id === undefined && name) idx.missing.add(name)
    return id
  }
  const heroes: RushHero[] = []
  for (const u of g.units ?? []) {
    const cell = HUYA_CELL.exec(u.cell ?? '')
    const name = rushText(u.name)
    if (!cell || !name) continue
    const id = heroId(name)
    const names = (u.equipment ?? []).map(rushText).filter(Boolean)
    const h: RushHero = {
      // Units that are not hero cards (e.g. 始祖熊灵, summoned by a talent) keep Huya's name and icon.
      id: id ?? 0,
      x: cell[1].charCodeAt(0) - 'A'.charCodeAt(0),
      z: 4 - Number(cell[2]),
      core: rushCore(u.core),
      awakened: !!u.awakened,
      equips: names.map((n) => idx.equip.get(n)?.id).filter((x): x is number => x !== undefined),
    }
    if (id === undefined) Object.assign(h, { name, icon: safeUrl(u.thumbnail) })
    const extra = names.filter((n) => !idx.equip.has(n))
    if (extra.length) h.extraEquips = extra
    heroes.push(h)
  }
  if (!heroes.length) return null

  const keyItems = rushText(g.keyItems)
  const keys = new Set(keyItems.split(/[,，、;；/\s]+/).map((s) => s.replace(/[。.！!]+$/, '')).filter(Boolean))
  const rounds = (g.auctionRounds ?? [])
    .flatMap((r) => {
      const round = toNum(r.round)
      if (round <= 0 || !r.primary?.name) return []
      const picks = [r.primary, ...(r.alternatives ?? [])].filter((c): c is RawRushCard => !!c?.name).map((c) => normRushPick(c, idx))
      return [{ round, picks, keyPick: keys.has(picks[0]!.name) }]
    })
    .sort((a, b) => a.round - b.round)
  const heroIds = (names: string[] | undefined) => (names ?? []).map(heroId).filter((x): x is number => x !== undefined)

  return {
    // "配置组1（截图匹配）" → "配置组1"
    label: rushText(g.label).replace(/（[^）]*）$/, ''),
    heroes,
    thought: rushText(g.thought),
    auctionAdvice: rushText(g.auctionAdvice),
    keyItems,
    rounds,
    added: heroIds(g.changes?.heroesAdded),
    removed: heroIds(g.changes?.heroesRemoved),
  }
}

function normRushLineup(r: RawRushLineup, data: HuyaRushData, idx: RushIndex): RushLineup | null {
  const groups = r.groups.map((g) => normRushGroup(g, idx)).filter((g): g is RushGroup => g !== null)
  const first = groups[0]
  if (!first) return null
  const ratings: Partial<Record<RushRoom, RushRating>> = {}
  for (const room of RUSH_ROOMS) {
    const x = data.ratings[r.id]?.[room]
    const grade = rushText(x?.grade)
    if (grade) ratings[room] = { grade, score: toNum(x?.score) }
  }
  const l: RushLineup = {
    id: r.id,
    name: rushText(r.title),
    category: rushText(r.category),
    subject: rushText(r.subject),
    camps: lineupCamps(first.heroes.map((h) => h.id), idx.heroById),
    groups,
    ratings,
  }
  const pack = normRushPack(r.id, data, idx)
  if (pack) l.pack = pack
  return l
}

/** Huya's 钻石狂潮 lineups with their opening packs. Optional: live data, else the snapshot, else none. */
async function syncRush(cards: Omit<RushIndex, 'icons' | 'missing'>): Promise<RushLineup[]> {
  return (await withSnapshot('钻石狂潮', fetchHuyaRush, RUSH_SNAPSHOT, (data) => buildRushLineups(data, cards))) ?? []
}

/** Throws when the data looks unusable. */
function buildRushLineups(data: HuyaRushData, cards: Omit<RushIndex, 'icons' | 'missing'>): RushLineup[] {
  const idx: RushIndex = { ...cards, icons: data.icons, missing: new Set() }
  const byId = new Map<string, RushLineup>()
  for (const raw of data.lineups) {
    if (byId.has(raw.id)) continue
    const l = normRushLineup(raw, data, idx)
    if (l) byId.set(l.id, l)
  }
  const lineups = [...byId.values()]
  if (lineups.length < RUSH_MIN_LINEUPS) {
    throw new Error(`only ${lineups.length} usable lineups (< ${RUSH_MIN_LINEUPS}), format may have changed`)
  }
  if (idx.missing.size) console.warn(`  ! 钻石狂潮: units not in official hero data (kept with Huya's icon): ${[...idx.missing].join(', ')}`)
  const count = (f: (l: RushLineup) => boolean) => lineups.filter(f).length
  console.log(
    `  rush: ${lineups.length} lineups, ${count((l) => !!l.pack)} packs, ${count((l) => Object.keys(l.ratings).length > 0)} rated, ` +
      `${count((l) => !!l.pack?.deploy.length)} deploy orders, ${data.icons.size} catalog icons`,
  )
  return lineups
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

  console.log('Fetching Huya lineups...')
  const nameIndex = (list: { id: number; name: string }[]) => new Map(list.map((c) => [c.name, c.id]))
  const huyaLineups = await syncHuya(lineupMap, {
    heroById,
    equip: nameIndex(equips),
    talent: nameIndex(talents),
    effect: nameIndex(effects),
    lord: nameIndex(lords),
  })

  console.log('Fetching 钻石狂潮...')
  const byName = <T extends { name: string }>(list: T[]) => new Map(list.map((c) => [c.name, c]))
  const rush = await syncRush({ heroById, hero: byName(heroes), equip: byName(equips), effect: byName(effects) })

  // Referential integrity report (warn only; the official data occasionally lags)
  const known = new Set<number>([...heroIds, ...equips.map((e) => e.id), ...talents.map((t) => t.id), ...effects.map((e) => e.id)])
  const unknown = new Set<number>()
  for (const l of [...lineups, ...huyaLineups]) {
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
    huyaLineups: huyaLineups.length,
    rushLineups: rush.length,
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
    [DATA_FILES.huyaLineups]: huyaLineups,
    [DATA_FILES.rush]: rush,
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
