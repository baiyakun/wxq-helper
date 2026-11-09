import { CODEX_TABS, type CodexTab } from '@/router'
import { usePersistentRef } from './usePersistentRef'

/** Last opened codex tab, so the 图鉴 nav item returns where the user left off. */
export const lastCodexTab = usePersistentRef<string>('codex:tab', 'heroes')

export const isCodexTab = (v: unknown): v is CodexTab => typeof v === 'string' && (CODEX_TABS as readonly string[]).includes(v)
