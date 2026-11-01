import { cn } from '@/lib/utils'

/**
 * Slow, continuous ticker of words (dance styles, press names). Pauses on hover; static and
 * wrapped under reduced motion. Duplicated content is hidden from assistive tech.
 */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-10 pr-10 sm:gap-16 sm:pr-16"
    >
      {items.map((item) => (
        <li key={item} className="flex items-center gap-10 sm:gap-16">
          <span className="type-display text-display-md whitespace-nowrap">{item}</span>
          <span aria-hidden className="bg-brand size-2.5 rounded-full" />
        </li>
      ))}
    </ul>
  )
  return (
    <div
      className={cn(
        'group border-foreground/10 flex overflow-hidden border-y [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)] py-6 sm:py-8',
        className,
      )}
    >
      <div className="animate-marquee flex w-max group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap">
        {row(false)}
        <div className="flex motion-reduce:hidden">{row(true)}</div>
      </div>
    </div>
  )
}
