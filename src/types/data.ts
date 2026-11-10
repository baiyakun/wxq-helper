/**
 * Normalized data model shared by the sync script and the web app.
 *
 * Rich text convention (all `desc`-like fields):
 *   {{text}}  -> highlighted text (numbers / emphasis in the game UI)
 *   [[text]]  -> keyword reference (may have an entry in `keywords`)
 * Plain text otherwise; never rendered as HTML.
 */

export type CampName = '三分之地' | '日落海' | '大河流域' | '河洛' | '逐鹿' | '无阵营'

export const CAMPS: readonly CampName[] = ['三分之地', '日落海', '大河流域', '河洛', '逐鹿', '无阵营']

/** Core-hero badge used by official lineups: 0 = normal, 1 = ACE carry, 2 = tank, 3 = utility */
export type CoreRole = 0 | 1 | 2 | 3

export interface HeroStats {
  hp: number
  atk: number
  ap: number
  def: number
  mdef: number
  /** attack interval in ms as given by the game (smaller = faster) */
  aspd: number
  crit: number
  critDmg: number
  energy: number
  initEnergy: number
  move: number
  range: number
}

export interface SkillEnhance {
  level: number
  desc: string
}

export interface HeroSkill {
  name: string
  desc: string
  icon: string
  enhance: SkillEnhance[]
}

export interface Hero {
  id: number
  name: string
  /** card tier 1-5 */
  quality: number
  camp: CampName
  avatar: string
  card: string
  /** official labels, e.g. 核心输出 / 核心功能 / 核心坦克 */
  labels: string[]
  desc: string
  awakenDesc: string
  skill: HeroSkill
  keywords: string[]
  stats: HeroStats
  /** related cards shown in the official handbook (summons, tokens, effect cards) */
  related: MiniCard[]
}

export type EquipSub = '基础装备' | '普通装备' | '天赋装备' | '特殊装备'
export type EquipKind = '通用装备' | '物理装备' | '法术装备' | '防御装备'

export interface Equip {
  id: number
  name: string
  quality: number
  icon: string
  sub: EquipSub | string
  kind: EquipKind | string
  desc: string
  /** base equips this one is forged from */
  from: number[]
  /** equips this base equip can be forged into */
  to: number[]
}

export interface CpInfo {
  /** the two hero ids that must be on the field together */
  heroes: [number, number]
  /** true when the talent also grants both hero cards */
  grantsCards: boolean
}

export interface Talent {
  id: number
  name: string
  /** 1 = 铜, 2 = 银, 3 = 金, 5 = 棋手专属 */
  quality: number
  icon: string
  desc: string
  /** e.g. 初始阵容 / 第一轮拍卖 ... 第八轮拍卖 */
  stage: string
  stageNo: number
  /** e.g. 初始天赋 / 天赋包一 */
  pack: string
  /**
   * Heroes the official data links to this talent (e.g. 技能突破：亚瑟 → 亚瑟).
   * 1-2 heroes: the talent is about those heroes; 3+: examples of a hero trait (any one counts).
   */
  heroes: number[]
  /** true when the talent gives you the cards of all linked heroes */
  grantsHeroes: boolean
  /** set when this is a pair talent (two heroes on the field together) */
  cp?: CpInfo
  /** set when this is a player's exclusive talent */
  lordId?: number
}

export interface EffectCard {
  id: number
  name: string
  quality: number
  icon: string
  /** 通用 / 无阵营 / camp name */
  camp: string
  pack: string
  cost: number
  desc: string
}

/** Self-contained small card (used where the card may not exist in the main tables) */
export interface MiniCard {
  id: number
  name: string
  icon: string
  desc: string
}

export interface LordSlot extends MiniCard {
  /** player level at which it unlocks */
  level: number
  /** cards this slot generates, e.g. 秘技牌 */
  cards: MiniCard[]
}

export interface Lord {
  id: number
  name: string
  avatar: string
  portrait: string
  skill: LordSlot | null
  secret: LordSlot | null
  exclusive: LordSlot | null
}

export interface LineupHero {
  id: number
  /** board column 0-6 */
  x: number
  /** board row 0-3, 0 = back row */
  z: number
  core: CoreRole
  awakened: boolean
  equips: number[]
}

export interface LineupStage {
  from: number
  to: number
  main: number[]
  sub: number[]
  desc: string
}

/** The three official lists */
export type OfficialSource = 'recommend' | 'hot' | 'beginner'
/** `huya`: collected by Huya's 万象棋助手 and not in any official list right now */
export type LineupSource = OfficialSource | 'huya'

/** Match stats published by Huya, aggregated over similar lineups (same core heroes) */
export interface LineupStats {
  matches: number
  /** average placement, 1-8 */
  avgPlace: number
  /** share of 1st places, 0-1 */
  top1: number
  /** share of top-3 places, 0-1 */
  top3: number
}

export interface Lineup {
  /** lineup key, also used as the in-game lineup code */
  key: string
  name: string
  sources: LineupSource[]
  /** rank inside each list (1-based) */
  rank: Partial<Record<LineupSource, number>>
  tags: string[]
  lords: number[]
  lordTips: Record<number, string>
  heroes: LineupHero[]
  /** camps with 3+ heroes (or the largest camp with 2+), most used first */
  camps: CampName[]
  talents: number[]
  effects: number[]
  author: string
  /** unix seconds (year inferred from the official "MM-DD" value) */
  createdAt: number
  uses: number
  score: number
  scoreNum: number
  likes: number
  brief: string
  positionDesc: string
  equipDesc: string
  talentDesc: string
  effectDesc: string
  stages: LineupStage[]
  /** official season id (0 when the source does not specify one) */
  season: number
  stats?: LineupStats
}

// ---------------------------------------------------------------------------
// 钻石狂潮 (Diamond Rush mode), from Huya's 万象棋助手
// ---------------------------------------------------------------------------

/** Rooms of the mode, by the diamonds brought in: 标准场 / 精英场 / 大师场 */
export type RushRoom = 'standard' | 'elite' | 'master'

export interface RushRating {
  /** S / A / B ... */
  grade: string
  /** 0-100 */
  score: number
}

export type RushCardKind = 'hero' | 'talent' | 'effect' | 'equip'

/**
 * A card as listed by Huya. Most 钻石狂潮 cards (auction talents and equipment, pack cards) are not
 * in the official data, so name, icon and text are carried along. `id` is the official card id
 * when the card exists in our tables (its detail can then be opened), otherwise 0.
 */
export interface RushCard {
  kind: RushCardKind
  id: number
  name: string
  icon: string
  /** rich text for official cards, plain text otherwise */
  desc: string
}

export interface RushStep {
  label: string
  reason: string
}

/** The opening card pack: a fixed set of cards, one of three offered at the start of a game */
export interface RushPack {
  name: string
  items: (RushCard & { count: number })[]
  /** order to play the pack's talent / effect cards; `label` is e.g. "P0 · 河洛助力" */
  opening: RushStep[]
  reminder: string
  /** hero deploy order; empty when the heroes have no hard order */
  deploy: RushStep[]
  deployFollowUp: string
  deployNote: string
  /** later picks from the shared effect-tip pool, by grade (S first) */
  tips: { grade: string; card: RushCard }[]
}

export interface RushPick extends RushCard {
  /** e.g. 通用系列 / 整备系列; empty for equipment */
  series: string
}

export interface RushRound {
  round: number
  /** primary pick first, then the alternatives */
  picks: RushPick[]
  /** the primary pick is one of the lineup's key items (worth bidding more) */
  keyPick: boolean
}

/** `id` is 0 for units that are not official hero cards (e.g. 始祖熊灵, summoned by a talent) */
export interface RushHero extends LineupHero {
  /** name and icon of a unit that is not an official hero (id 0) */
  name?: string
  icon?: string
  /** equipment that is not in the official data (e.g. hero-specific items), by name */
  extraEquips?: string[]
}

/** A lineup variant; the second one is usually the late-game transition */
export interface RushGroup {
  label: string
  heroes: RushHero[]
  thought: string
  auctionAdvice: string
  keyItems: string
  rounds: RushRound[]
  /** hero changes compared to the first group */
  added: number[]
  removed: number[]
}

export interface RushLineup {
  /** Huya's id, shared by the lineup and its opening pack */
  id: string
  name: string
  /** pack category: 逆天改命 / 契约 / 草根狂潮 / 常规阵营 / 夺取 */
  category: string
  /** main hero or camp named in the title */
  subject: string
  camps: CampName[]
  groups: RushGroup[]
  pack?: RushPack
  ratings: Partial<Record<RushRoom, RushRating>>
}

export interface DataMeta {
  /** ISO time of the sync run that produced a data change */
  updatedAt: string
  /** newest Last-Modified header among the official source files */
  sourceModifiedAt: string
  /** content hash of all normalized data files */
  hash: string
  counts: {
    heroes: number
    equips: number
    talents: number
    effects: number
    lords: number
    /** official lineups */
    lineups: number
    /** extra lineups from Huya (0 when that source was unavailable) */
    huyaLineups: number
    /** 钻石狂潮 lineups from Huya (0 when that source was unavailable) */
    rushLineups: number
    cpTalents: number
  }
}

export interface Keyword {
  name: string
  desc: string
}

/** File names under public/data */
export const DATA_FILES = {
  heroes: 'heroes.json',
  equips: 'equips.json',
  talents: 'talents.json',
  effects: 'effects.json',
  lords: 'lords.json',
  lineups: 'lineups.json',
  /** loaded in the background after the app has started */
  huyaLineups: 'lineups-huya.json',
  /** 钻石狂潮 lineups and packs, also loaded in the background */
  rush: 'rush.json',
  keywords: 'keywords.json',
  meta: 'meta.json',
} as const
