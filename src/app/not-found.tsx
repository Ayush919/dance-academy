import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main
      data-theme="stage"
      className="bg-background text-foreground grain flex min-h-dvh flex-col items-start justify-center gap-6 px-4 sm:px-12"
    >
      <p className="type-eyebrow text-brand">404</p>
      <h1 className="type-display text-display-xl">
        Missed <span className="type-accent text-brand">a step.</span>
      </h1>
      <p className="text-muted-foreground max-w-md">
        This page doesn’t exist or has moved. Let’s get you back on the floor.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="brand" size="xl">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="stage-outline" size="xl">
          <Link href="/programs">See programs</Link>
        </Button>
      </div>
    </main>
  )
}
