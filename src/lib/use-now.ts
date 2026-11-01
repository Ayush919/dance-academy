'use client'

import { useSyncExternalStore } from 'react'

/**
 * The current time, refreshed every `intervalMs`. Renders 0 on the server and first paint, so
 * countdowns never cause a hydration mismatch (show a placeholder while it is 0).
 */
export function useNow(intervalMs = 1000): number {
  return useSyncExternalStore(
    (notify) => {
      const id = setInterval(notify, intervalMs)
      return () => clearInterval(id)
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  )
}

/** "14:32" for a countdown, or "Expired". */
export function countdown(untilIso: string, now: number): string {
  if (!now) return '…'
  const left = Math.max(0, new Date(untilIso).getTime() - now)
  if (left === 0) return 'Expired'
  const totalMinutes = Math.floor(left / 60_000)
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60)
    return `${h}h ${totalMinutes % 60}m`
  }
  return `${totalMinutes}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`
}
