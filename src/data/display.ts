/** Display helpers: labels and colors for tiers, camps and grades. Colors are CSS variables from style.css. */

const CAMP_VAR: Record<string, string> = {
  三分之地: '--camp-sanfen',
  日落海: '--camp-riluo',
  大河流域: '--camp-dahe',
  河洛: '--camp-heluo',
  逐鹿: '--camp-zhulu',
  无阵营: '--camp-none',
}

export const campColor = (camp: string) => `var(${CAMP_VAR[camp] ?? '--camp-none'})`

/** Card tier color (heroes 1-5, effect cards 1-6). */
export const tierColor = (q: number) => `var(--q${Math.min(Math.max(q, 1), 6)})`

export const TALENT_GRADE: Record<number, { label: string; color: string }> = {
  1: { label: '铜', color: 'var(--t-bronze)' },
  2: { label: '银', color: 'var(--t-silver)' },
  3: { label: '金', color: 'var(--t-gold)' },
  5: { label: '专属', color: 'var(--t-exclusive)' },
}

export const talentGrade = (q: number) => TALENT_GRADE[q] ?? { label: `${q}阶`, color: 'var(--q1)' }

export const EQUIP_SUB_COLOR: Record<string, string> = {
  基础装备: 'var(--q1)',
  普通装备: 'var(--q3)',
  天赋装备: 'var(--t-gold)',
  特殊装备: 'var(--q5)',
}

export const equipColor = (sub: string) => EQUIP_SUB_COLOR[sub] ?? 'var(--q1)'

/** Talent stages in game order, used for filter chips. */
export const STAGE_ORDER = [
  '初始阵容',
  '第一轮拍卖',
  '第二轮拍卖',
  '第三轮拍卖',
  '第四轮拍卖',
  '第五轮拍卖',
  '第六轮拍卖',
  '第七轮拍卖',
  '第八轮拍卖',
]

/** Short label for stage chips: 第一轮拍卖 -> 拍卖1 */
export function stageShort(stage: string): string {
  const i = STAGE_ORDER.indexOf(stage)
  return i > 0 ? `拍卖${i}` : stage
}

export const PACK_ORDER = ['初始天赋', '天赋包一', '天赋包二', '天赋包三', '天赋包四']
export const EFFECT_PACK_ORDER = ['初始效果牌', '效果牌包一', '效果牌包二', '效果牌包三', '效果牌包四']

/** Sort strings by a preferred order; unknown values go last in natural order. */
export function byOrder(order: readonly string[]) {
  return (a: string, b: string) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, 'zh-CN')
  }
}
