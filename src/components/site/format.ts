import { formatMoney } from '@/lib/money'
import { LEVEL_LABELS, MODE_LABELS, type Level, type Mode } from '@/server/domain/enums'

export const levelLabel = (l: string) => LEVEL_LABELS[l as Level] ?? l
export const modeLabel = (m: string) => MODE_LABELS[m as Mode] ?? m
export const ages = (min: number, max: number | null) =>
  max ? `Ages ${min}–${max}` : `Ages ${min}+`
export const price = (p: { amount: number; per: string } | null) =>
  p ? `${formatMoney(p.amount)}${p.per}` : 'Ask for fees'

export function eventDate(
  date: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long' },
) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' })
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
