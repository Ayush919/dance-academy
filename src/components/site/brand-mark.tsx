import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Typographic wordmark. Replaced by the uploaded logo once Brand Settings exist (Phase 5); kept as
 * the fallback when no logo is set.
 */
export function BrandMark({
  className,
  href = '/',
  compact = false,
}: {
  className?: string
  href?: string
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn('group inline-flex items-baseline gap-2 leading-none', className)}
      aria-label="Remo Dance Company — home"
    >
      <span className="type-display text-[1.6rem] tracking-[0.02em]">
        Remo<span className="text-brand">.</span>
      </span>
      {!compact && (
        <span className="text-muted-foreground hidden text-[0.6rem] font-medium tracking-[0.32em] uppercase sm:inline">
          Dance Company
        </span>
      )}
    </Link>
  )
}
