'use client'

import { useEffect, useSyncExternalStore } from 'react'

/** Readable breadcrumb names for dynamic segments (record IDs), set by the page that knows them. */
const labels = new Map<string, string>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

export function useCrumbLabels() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
    () => 0,
  )
  return labels
}

export function CrumbLabel({ segment, label }: { segment: string; label: string }) {
  useEffect(() => {
    labels.set(segment, label)
    emit()
  }, [segment, label])
  return null
}
