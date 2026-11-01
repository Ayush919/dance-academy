'use client'

import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from './empty-state'

/**
 * Body for `error.tsx` boundaries. Shows a calm message and a retry; the technical detail goes to
 * the console and server logs, never to the screen. `digest` lets support match the server log.
 */
export function ErrorState({
  error,
  reset,
  title = 'Something went wrong',
  description = 'This part of the page could not load. Try again, and if it keeps happening let us know.',
}: {
  error: Error & { digest?: string }
  reset?: () => void
  title?: string
  description?: string
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <EmptyState
      icon={TriangleAlert}
      title={title}
      description={
        <>
          {description}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs opacity-70">Ref: {error.digest}</span>
          )}
        </>
      }
      action={
        reset && (
          <Button variant="outline" onClick={reset}>
            <RotateCcw /> Try again
          </Button>
        )
      }
    />
  )
}
