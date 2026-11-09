/**
 * Lineups collected by Huya's 王者万象棋助手 (https://gametool.huya.com/hokc).
 *
 * The tool ships its data as JSON string literals inside its Vite chunks:
 *   home page → entry script (assets/index-*.js) → assets/lineupClassic-*.js  万象大赛 lineup library
 *                                               → assets/LineupPage-*.js     match stats per lineup
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
  throw new Error(`Failed to fetch ${url}: ${String(lastError)}`)
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

export async function fetchHuya(): Promise<HuyaData> {
  const home = await fetchText(HOME)
  const entryPath = /<script[^>]*type="module"[^>]*src="([^"]*\/assets\/index-[\w-]+\.js)"/.exec(home)?.[1]
  if (!entryPath) throw new Error('entry script not found on the home page')
  const entryUrl = new URL(entryPath, HOME)
  const entry = await fetchText(entryUrl.href)
  const chunkUrl = (name: string) => {
    const rel = new RegExp(`assets/${name}-[\\w-]+\\.js`).exec(entry)?.[0]
    if (!rel) throw new Error(`chunk ${name} not referenced by the entry script`)
    // Chunk paths are relative to the app base, i.e. the parent of assets/.
    return new URL(rel, new URL('..', entryUrl)).href
  }
  const [classic, page] = await Promise.all([fetchText(chunkUrl('lineupClassic')), fetchText(chunkUrl('LineupPage'))])

  // The lineup library is the largest array of lineup-shaped objects.
  const arrays = extractJsonLiterals(classic).filter((v): v is unknown[] => Array.isArray(v))
  const library = arrays.sort((a, b) => b.length - a.length).find((a) => a.some(isLineup))
  if (!library) throw new Error('lineup library not found in lineupClassic chunk')

  const statsObj = extractJsonLiterals(page).find((v) => isObject(v) && Object.values(v).length > 0 && Object.values(v).every(isStat))
  const stats = new Map<string, RawHuyaStat>(isObject(statsObj) ? Object.entries(statsObj).filter((e): e is [string, RawHuyaStat] => isStat(e[1])) : [])

  return { lineups: library.filter(isLineup), stats }
}
