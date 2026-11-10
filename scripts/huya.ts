/**
 * Lineups collected by Huya's 王者万象棋助手 (https://gametool.huya.com/hokc).
 *
 * The tool ships its data as JSON string literals inside its Vite chunks:
 *   home page → entry script (assets/index-*.js) → assets/lineupClassic-*.js  万象大赛 lineup library
 *                                               → assets/LineupPage-*.js     match stats per lineup
 *                                               → assets/lineupLibrary-*.js  钻石狂潮 lineups + auction picks
 *                                               → assets/LineupBattleStats-*.js  钻石狂潮 packs, ratings, deploy order
 *                                               → assets/wikiCatalog-*.js    card icons (钻石狂潮 cards included)
 * Some 钻石狂潮 data is written as plain JS object literals instead of JSON strings; those are read
 * with a small parser that only accepts data (objects, arrays, strings, numbers, booleans, null).
 * Chunk names carry a content hash, so they are discovered from the entry script on every run.
 * The literals are decoded as plain data; Huya's scripts are never executed.
 */

const HOME = 'https://gametool.huya.com/hokc'
const USER_AGENT = 'wxq-helper-sync/0.1 (personal research)'
// The lineup library chunk is ~10 MB.
const TIMEOUT_MS = 90_000
const RETRIES = 3

// Raw shapes – only the fields we read; everything is optional because the source is not ours.

export interface RawHuyaHeroRef {
  id?: number | string
}

export interface RawHuyaUnit extends RawHuyaHeroRef {
  /** board cell, column A-G + row 1-4 (1 = front row) */
  cell?: string | null
  /** core role, same codes as the official data */
  t?: number
  evo?: boolean
  /** equipment names */
  eq?: string[]
}

export interface RawHuyaGroup {
  id?: string
  thought?: string
  auctionAdvice?: string
  keyItems?: string
  units?: RawHuyaUnit[]
  talentCards?: { name?: string }[]
  effectCards?: { name?: string }[]
  operations?: { roundRange?: string; desc?: string; mainHeroes?: RawHuyaHeroRef[]; subHeroes?: RawHuyaHeroRef[] }[]
}

export interface RawHuyaLineup {
  id: string
  code: string | number
  title?: string
  author?: string
  createTimestamp?: string | number
  useNum?: number
  score?: string | number
  brief?: string
  equipDesc?: string
  positionDesc?: string
  activeGroup?: string
  groups: RawHuyaGroup[]
  lords?: { name?: string; note?: string }[]
}

export interface RawHuyaStat {
  count?: number
  avgPlacement?: number
  firstRate?: number
  top3Rate?: number
}

export interface HuyaData {
  lineups: RawHuyaLineup[]
  /** keyed by RawHuyaLineup.id */
  stats: Map<string, RawHuyaStat>
}

/**
 * An error with its cause chain: fetch() only says "fetch failed" and keeps the network error
 * (e.g. UND_ERR_CONNECT_TIMEOUT, ECONNRESET, ENOTFOUND) in `cause`.
 */
export function describeError(err: unknown): string {
  const parts: string[] = []
  for (let e = err, depth = 0; e != null && depth < 4; e = e instanceof Error ? e.cause : undefined, depth++) {
    if (!(e instanceof Error)) {
      parts.push(String(e))
      continue
    }
    const code = (e as { code?: unknown }).code
    // AggregateError (one error per attempted address) often has an empty message.
    const message = e.message || (e instanceof AggregateError ? e.errors.map((x) => describeError(x)).join('; ') : '')
    parts.push(`${e.name}${typeof code === 'string' ? ` ${code}` : ''}: ${message}`)
  }
  return parts.join(' ← ')
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastError = err
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  throw new Error(`Failed to fetch ${url}: ${describeError(lastError)}`)
}

const SIMPLE_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }

/** Decode every `JSON.parse('…')` argument in a script (single-quoted JS string literals). */
export function extractJsonLiterals(src: string): unknown[] {
  const out: unknown[] = []
  const open = "JSON.parse('"
  let i = 0
  while ((i = src.indexOf(open, i)) !== -1) {
    i += open.length
    let s = ''
    for (; i < src.length && src[i] !== "'"; i++) {
      const c = src[i]!
      if (c !== '\\') {
        s += c
        continue
      }
      const n = src[++i] ?? ''
      if (n === 'u' || n === 'x') {
        const len = n === 'u' ? 4 : 2
        s += String.fromCharCode(parseInt(src.slice(i + 1, i + 1 + len), 16))
        i += len
      } else {
        s += SIMPLE_ESCAPES[n] ?? n
      }
    }
    try {
      out.push(JSON.parse(s))
    } catch {
      // not data we care about
    }
  }
  return out
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const isLineup = (v: unknown): v is RawHuyaLineup =>
  isObject(v) && typeof v.id === 'string' && (typeof v.code === 'string' || typeof v.code === 'number') && Array.isArray(v.groups)

const isStat = (v: unknown): v is RawHuyaStat => isObject(v) && typeof v.avgPlacement === 'number' && typeof v.firstRate === 'number'

interface Site {
  /** URLs of every chunk named `name` (there can be several, e.g. wikiCatalog-a.js and wikiCatalog-b.js) */
  chunkUrls(name: string): string[]
}

let sitePromise: Promise<Site> | null = null

/** Home page and entry script, fetched once per run and shared by the classic and 钻石狂潮 syncs. */
function loadSite(): Promise<Site> {
  sitePromise ??= (async () => {
    const home = await fetchText(HOME)
    const entryPath = /<script[^>]*type="module"[^>]*src="([^"]*\/assets\/index-[\w-]+\.js)"/.exec(home)?.[1]
    if (!entryPath) throw new Error('entry script not found on the home page')
    const entryUrl = new URL(entryPath, HOME)
    const entry = await fetchText(entryUrl.href)
    // Chunk paths are relative to the app base, i.e. the parent of assets/.
    const base = new URL('..', entryUrl)
    return {
      chunkUrls: (name) => [...new Set(entry.match(new RegExp(`assets/${name}-[\\w-]+\\.js`, 'g')) ?? [])].map((rel) => new URL(rel, base).href),
    }
  })()
  // A failed attempt must not be cached for the next caller.
  sitePromise.catch(() => (sitePromise = null))
  return sitePromise
}

async function fetchChunk(site: Site, name: string): Promise<string> {
  const urls = site.chunkUrls(name)
  if (!urls.length) throw new Error(`chunk ${name} not referenced by the entry script`)
  return (await Promise.all(urls.map(fetchText))).join('\n')
}

export async function fetchHuya(): Promise<HuyaData> {
  const site = await loadSite()
  const [classic, page] = await Promise.all([fetchChunk(site, 'lineupClassic'), fetchChunk(site, 'LineupPage')])

  // The lineup library is the largest array of lineup-shaped objects.
  const arrays = extractJsonLiterals(classic).filter((v): v is unknown[] => Array.isArray(v))
  const library = arrays.sort((a, b) => b.length - a.length).find((a) => a.some(isLineup))
  if (!library) throw new Error('lineup library not found in lineupClassic chunk')

  const statsObj = extractJsonLiterals(page).find((v) => isObject(v) && Object.values(v).length > 0 && Object.values(v).every(isStat))
  const stats = new Map<string, RawHuyaStat>(isObject(statsObj) ? Object.entries(statsObj).filter((e): e is [string, RawHuyaStat] => isStat(e[1])) : [])

  return { lineups: library.filter(isLineup), stats }
}

// ---------------------------------------------------------------------------
// JS data literals
// ---------------------------------------------------------------------------

const IDENT = /[A-Za-z_$][\w$]*/y
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y

/**
 * Parse the JavaScript data literal that starts at `start` (object, array, string, number,
 * `true`/`false`/`!0`/`!1`, `null`), as minifiers emit constant data. Anything that is not plain
 * data – identifiers as values, calls, spreads, template substitutions – throws. Nothing is executed.
 */
export function parseJsLiteral(src: string, start: number): { value: unknown; end: number } {
  let i = start
  const fail = (what: string): never => {
    throw new Error(`${what} at ${i}`)
  }
  const skipWs = () => {
    while (i < src.length && /\s/.test(src[i]!)) i++
  }
  const sticky = (re: RegExp) => {
    re.lastIndex = i
    const m = re.exec(src)
    if (!m) return null
    i += m[0].length
    return m[0]
  }

  function str(): string {
    const q = src[i++]!
    let s = ''
    while (i < src.length) {
      const c = src[i++]!
      if (c === q) return s
      if (q === '`' && c === '$' && src[i] === '{') fail('template substitution')
      if (q !== '`' && (c === '\n' || c === '\r')) fail('newline in string')
      if (c !== '\\') {
        s += c
        continue
      }
      const n = src[i++] ?? ''
      if (n === 'x') {
        s += String.fromCharCode(parseInt(src.slice(i, i + 2), 16))
        i += 2
      } else if (n === 'u' && src[i] === '{') {
        const close = src.indexOf('}', i)
        s += String.fromCodePoint(parseInt(src.slice(i + 1, close), 16))
        i = close + 1
      } else if (n === 'u') {
        s += String.fromCharCode(parseInt(src.slice(i, i + 4), 16))
        i += 4
      } else if (n === '\r' || n === '\n') {
        // line continuation
        if (n === '\r' && src[i] === '\n') i++
      } else {
        s += SIMPLE_ESCAPES[n] ?? n
      }
    }
    return fail('unterminated string')
  }

  function key(): string {
    const c = src[i]
    if (c === '"' || c === "'") return str()
    return sticky(IDENT) ?? sticky(NUMBER) ?? fail('bad key')
  }

  function value(): unknown {
    skipWs()
    const c = src[i]
    if (c === '{') {
      i++
      // Own properties only: a "__proto__" key must not change the prototype.
      const obj: Record<string, unknown> = {}
      skipWs()
      while (src[i] !== '}') {
        const k = key()
        skipWs()
        if (src[i++] !== ':') fail('expected ":"')
        const v = value()
        Object.defineProperty(obj, k, { value: v, enumerable: true, writable: true, configurable: true })
        skipWs()
        if (src[i] === ',') {
          i++
          skipWs()
        } else if (src[i] !== '}') fail('expected "," or "}"')
      }
      i++
      return obj
    }
    if (c === '[') {
      i++
      const arr: unknown[] = []
      skipWs()
      while (src[i] !== ']') {
        arr.push(value())
        skipWs()
        if (src[i] === ',') {
          i++
          skipWs()
        } else if (src[i] !== ']') fail('expected "," or "]"')
      }
      i++
      return arr
    }
    if (c === '"' || c === "'" || c === '`') return str()
    if (c === '!' && (src[i + 1] === '0' || src[i + 1] === '1')) {
      i += 2
      return src[i - 1] === '0'
    }
    const num = sticky(NUMBER)
    if (num !== null) return Number(num)
    const word = sticky(IDENT)
    if (word === 'true') return true
    if (word === 'false') return false
    if (word === 'null') return null
    return fail(`not a data literal (${word ?? c})`)
  }

  const v = value()
  return { value: v, end: i }
}

/** Every literal assigned in a script (`x={…}` / `x=[…]`) that starts with `head`, parsed; non-data is skipped. */
export function findJsLiterals(src: string, head: RegExp): unknown[] {
  const out: unknown[] = []
  for (const m of src.matchAll(new RegExp(`=(?=${head.source})`, 'g'))) {
    try {
      out.push(parseJsLiteral(src, m.index + 1).value)
    } catch {
      // not plain data
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 钻石狂潮
// ---------------------------------------------------------------------------

export interface RawRushCard {
  id?: string | number
  name?: string
  /** 资源 / 装备 / 契约·共振 */
  kind?: string
  /** talent / auction-equipment */
  type?: string
  /** "<series>系列\n<text>" for talents, plain text for equipment */
  attrs?: string
}

export interface RawRushUnit {
  /** column A-G + row 1-4 (1 = front row) */
  cell?: string
  name?: string
  awakened?: boolean
  /** e.g. "主输出位（Attack / CoreDps）" / "无核心标记" */
  core?: string
  thumbnail?: string
  equipment?: string[]
}

export interface RawRushGroup {
  id?: string
  label?: string
  thought?: string
  auctionAdvice?: string
  keyItems?: string
  units?: RawRushUnit[]
  auctionRounds?: { round?: number; primary?: RawRushCard | null; alternatives?: (RawRushCard | null)[] }[]
  changes?: { heroesAdded?: string[]; heroesRemoved?: string[] }
}

export interface RawRushLineup {
  id: string
  title?: string
  category?: string
  subject?: string
  groups: RawRushGroup[]
}

export interface RawRushPack {
  packName?: string
  mechanicReminder?: string
  contents?: { cardId?: number; name?: string; cardType?: string; count?: number; effectSummary?: string }[]
  opening?: { priority?: string; name?: string; reason?: string }[]
  /** S / A / B → later effect tips from the shared pool */
  recs?: Record<string, { name?: string; effectSummary?: string }[]>
}

export interface RawRushRating {
  grade?: string
  score?: number
}

export interface RawRushDeploy {
  steps?: { label?: string; reason?: string }[]
  followUp?: string
  note?: string
}

/** Huya ids are 12 hex digits; lineups, packs, ratings and deploy orders share them. */
export interface HuyaRushData {
  lineups: RawRushLineup[]
  packs: Record<string, RawRushPack>
  /** room (standard / elite / master) → rating */
  ratings: Record<string, Record<string, RawRushRating>>
  deploys: Record<string, RawRushDeploy>
  /** icons of Huya's card catalog by card name and by card id (empty when the catalog is unavailable) */
  icons: Map<string, string>
}

const isRushLineup = (v: unknown): v is RawRushLineup =>
  isObject(v) && typeof v.id === 'string' && Array.isArray(v.groups) && v.groups.some((g) => isObject(g) && Array.isArray(g.auctionRounds))

/** A non-empty `{ id: {...} }` map whose entries look like `entry`. */
const isMapOf =
  (entry: (v: Record<string, unknown>) => boolean) =>
  (v: unknown): v is Record<string, Record<string, unknown>> => {
    if (!isObject(v)) return false
    const values = Object.values(v)
    return values.length > 0 && values.every(isObject) && values.filter(entry).length >= values.length / 2
  }

const isPackMap = isMapOf((p) => typeof p.packName === 'string' && Array.isArray(p.contents))
const isRatingMap = isMapOf((r) => ['standard', 'elite', 'master'].some((k) => isObject(r[k]) && typeof r[k].grade === 'string'))
const isDeployMap = isMapOf((d) => Array.isArray(d.steps))

/** The largest candidate that passes `valid` (by number of entries). */
function largest<T>(candidates: unknown[], valid: (v: unknown) => v is T): T | undefined {
  const size = (v: unknown) => (Array.isArray(v) ? v.length : isObject(v) ? Object.keys(v).length : 0)
  return candidates.filter(valid).sort((a, b) => size(b) - size(a))[0]
}

/** Card icons from Huya's catalog, which also covers 钻石狂潮 cards that are not in the official data. */
function catalogIcons(src: string): Map<string, string> {
  const icons = new Map<string, string>()
  const lists = [...extractJsonLiterals(src), ...findJsLiterals(src, /\[\{id:"/)].filter(Array.isArray)
  for (const list of lists) {
    for (const c of list) {
      if (!isObject(c) || typeof c.icon !== 'string' || !c.icon.startsWith('https://')) continue
      for (const k of [c.name, c.id]) if (typeof k === 'string' && k && !icons.has(k)) icons.set(k, c.icon)
    }
  }
  return icons
}

export async function fetchHuyaRush(): Promise<HuyaRushData> {
  const site = await loadSite()
  const [library, battle, catalog] = await Promise.all([
    fetchChunk(site, 'lineupLibrary'),
    fetchChunk(site, 'LineupBattleStats'),
    // Icons are optional.
    fetchChunk(site, 'wikiCatalog').catch(() => ''),
  ])
  const candidates = [
    ...extractJsonLiterals(library),
    ...extractJsonLiterals(battle),
    // Ratings and deploy orders are plain object literals keyed by lineup id.
    ...findJsLiterals(battle, /\{"?[0-9a-f]{12}"?:\{/),
  ]
  const lineups = largest(candidates, (v): v is unknown[] => Array.isArray(v) && v.some(isRushLineup))?.filter(isRushLineup)
  if (!lineups?.length) throw new Error('钻石狂潮 lineup library not found')
  return {
    lineups,
    packs: (largest(candidates, isPackMap) ?? {}) as Record<string, RawRushPack>,
    ratings: (largest(candidates, isRatingMap) ?? {}) as Record<string, Record<string, RawRushRating>>,
    deploys: (largest(candidates, isDeployMap) ?? {}) as Record<string, RawRushDeploy>,
    icons: catalogIcons(catalog),
  }
}
