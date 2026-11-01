import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Primary "New …" action for list pages. */
export function NewButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild>
      <Link href={href}>
        <Plus /> {label}
      </Link>
    </Button>
  )
}

/** Filter chips that set a single query parameter (status, branch …). */
export function FilterChips({
  basePath,
  param,
  current,
  options,
  keep = {},
}: {
  basePath: string
  param: string
  current: string | undefined
  options: { value: string | undefined; label: string }[]
  keep?: Record<string, string | undefined>
}) {
  return (
    <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const qs = new URLSearchParams(
          Object.entries({ ...keep, [param]: o.value }).filter(
            (e): e is [string, string] => !!e[1],
          ),
        ).toString()
        const active = (current ?? undefined) === o.value
        return (
          <Link
            key={o.label}
            href={qs ? `${basePath}?${qs}` : basePath}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              active ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted',
            )}
          >
            {o.label}
          </Link>
        )
      })}
    </nav>
  )
}
