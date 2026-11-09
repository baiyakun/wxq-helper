/** Stroke icon paths (24x24 viewBox). */
export const ICON_PATHS = {
  lineups: 'M4 5h16v14H4z M4 12h16 M12 5v14',
  recommend: 'M12 3l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.4 7 18.2l1.2-5.6L4 8.8l5.6-.6z',
  codex: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z M5 19.5A1.5 1.5 0 0 0 6.5 21H19 M9 7h6',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-3.6-3.6',
  close: 'M6 6l12 12 M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 5l-7 7 7 7',
  copy: 'M9 9h10v10H9z M5 15V5h10',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  shield: 'M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6z',
  bolt: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
  plus: 'M12 5v14 M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  filter: 'M4 5h16l-6.2 7.4V18l-3.6 1.8v-7.4z',
} as const

export type IconName = keyof typeof ICON_PATHS

/** Option for ChipGroup */
export interface ChipOption<V> {
  value: V
  label: string
  color?: string
}

/** Core-hero markers used by official lineups: 1 = ACE carry, 2 = tank, 3 = utility. */
export const CORE_META = {
  1: { label: '主C', icon: 'star', color: '#f0645a' },
  2: { label: '坦克', icon: 'shield', color: '#4b9ef0' },
  3: { label: '功能', icon: 'bolt', color: '#3fb47a' },
} as const satisfies Record<number, { label: string; icon: IconName; color: string }>
