/** Number/date formatting helpers for display. */

export function formatWan(n: number): string {
  if (n < 10000) return String(n)
  const v = (n / 10000).toFixed(1).replace(/\.0$/, '')
  return `${v}万`
}

/** unix seconds -> "MM-DD"; empty when unknown */
export function formatMonthDay(sec: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const formatDateTime = (msOrIso: number | string) =>
  new Date(msOrIso).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
