/** 钻石狂潮 helpers: rooms, pack categories, grade colors and the auction bid estimate. */
import type { RushGroup, RushHero, RushLineup, RushRoom } from '@/types/data'

export const RUSH_ROOMS: readonly { value: RushRoom; label: string; range: string }[] = [
  { value: 'standard', label: '标准场', range: '带入 100~500' },
  { value: 'elite', label: '精英场', range: '带入 1000~5000' },
  { value: 'master', label: '大师场', range: '带入 4000~20000' },
]

export const isRushRoom = (v: unknown): v is RushRoom => RUSH_ROOMS.some((r) => r.value === v)
export const roomLabel = (room: RushRoom) => RUSH_ROOMS.find((r) => r.value === room)?.label ?? room

/** Pack categories in display order */
export const RUSH_CATEGORIES = ['逆天改命', '契约', '草根狂潮', '常规阵营', '夺取']

/** Huya calls camp packs "常规阵营"; the packs themselves are named "阵营卡包". */
export const categoryLabel = (c: string) => (c === '常规阵营' ? '阵营' : c)

const GRADE_COLOR: Record<string, string> = { S: 'var(--q5)', A: 'var(--q4)', B: 'var(--q3)' }
export const gradeColor = (grade: string) => GRADE_COLOR[grade] ?? 'var(--q1)'

/** Rating score in a room; unrated lineups sort last. */
export const scoreIn = (l: RushLineup, room: RushRoom) => l.ratings[room]?.score ?? -1

export const byScore = (room: RushRoom) => (a: RushLineup, b: RushLineup) => scoreIn(b, room) - scoreIn(a, room)

/** Core heroes (carry, tank, utility) first, then the rest in board order. */
const CORE_ORDER = [9, 0, 1, 2]
export const sortHeroes = (heroes: readonly RushHero[]) => [...heroes].sort((a, b) => (CORE_ORDER[a.core] ?? 9) - (CORE_ORDER[b.core] ?? 9))

/** The hero the lineup is built around: its carry, else its first hero. */
export const mainHero = (g: RushGroup | undefined) => g?.heroes.find((h) => h.core === 1) ?? g?.heroes[0]

// ---------------------------------------------------------------------------
// Bid estimate
// ---------------------------------------------------------------------------

/**
 * Highest bid worth paying for an auction pick, as estimated by Huya's 万象棋助手 (2026-11):
 * it assumes the room's default bring-in (80% of its maximum) and a prize pool of 6 × 30% of the
 * maximum, spends a round-dependent share of that pool (more for key items and late rounds),
 * and never more than 30% of the balance. A rough guide, not a live calculation.
 */
const ROOM_BID: Record<RushRoom, { bringMax: number; opening: number; step: number }> = {
  standard: { bringMax: 500, opening: 5, step: 5 },
  elite: { bringMax: 5000, opening: 50, step: 50 },
  master: { bringMax: 20000, opening: 200, step: 200 },
}

export type BidTier = 'alternative' | 'primary' | 'key'

const POOL_SHARE: Record<number, Record<BidTier, number>> = {
  1: { alternative: 0.005, primary: 0.01, key: 0.015 },
  2: { alternative: 0.005, primary: 0.01, key: 0.015 },
  3: { alternative: 0.0067, primary: 0.015, key: 0.0217 },
  4: { alternative: 0.0067, primary: 0.015, key: 0.0217 },
  5: { alternative: 0.01, primary: 0.02, key: 0.03 },
  6: { alternative: 0.01, primary: 0.0217, key: 0.03 },
  7: { alternative: 0.0117, primary: 0.025, key: 0.0367 },
  8: { alternative: 0.0167, primary: 0.03, key: 0.0467 },
}

/** Minimum bid above the opening bid, in bid steps */
const TIER_STEPS: Record<BidTier, number> = { alternative: 0, primary: 1, key: 2 }

const roundTo10 = (n: number) => Math.round(n / 10 + Number.EPSILON * Math.abs(n / 10)) * 10
const floorTo10 = (n: number) => Math.floor(n / 10) * 10

/** Round down to a valid bid (opening bid + whole steps); 0 when below the opening bid. */
function toBid(n: number, opening: number, step: number): number {
  if (!Number.isFinite(n) || n < opening) return 0
  return opening + Math.floor((n - opening) / step) * step
}

/** Estimated highest bid in diamonds; 0 when there is no estimate for the round. */
export function maxBid(round: number, room: RushRoom, tier: BidTier): number {
  const r = ROOM_BID[room]
  const share = POOL_SHARE[round]?.[tier]
  if (!share) return 0
  const pool = Math.round(r.bringMax * 0.3 * 6)
  const balance = Math.round(r.bringMax * 0.8)
  const cap = toBid(floorTo10(balance * 0.3), r.opening, r.step)
  if (cap < r.opening) return 0
  const wanted = toBid(roundTo10(pool * share), r.opening, r.step)
  return Math.min(cap, Math.max(r.opening + TIER_STEPS[tier] * r.step, wanted))
}
