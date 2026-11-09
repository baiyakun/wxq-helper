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
  /** the two hero ids that must fight together (共战) */
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
  /** set when this is a CP (共战) talent */
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

export type LineupSource = 'recommend' | 'hot' | 'beginner'

export interface Lineup {
  /** official lineup key, also used as the in-game lineup code */
  key: string
  name: string
  sources: LineupSource[]
  /** rank inside each official list (1-based) */
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
    lineups: number
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
  keywords: 'keywords.json',
  meta: 'meta.json',
} as const
