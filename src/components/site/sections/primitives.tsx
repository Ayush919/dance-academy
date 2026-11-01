import { cn } from '@/lib/utils'
import { Reveal, RevealLines } from '@/components/motion/reveal'

/** Page-width container with the site's gutters (16px on phones). */
export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12', className)}
      {...props}
    />
  )
}

/**
 * A page section. `surface="ivory"` switches to the warm light band (used sparingly for rhythm);
 * `index` renders the editorial section number.
 */
export function Section({
  className,
  surface = 'stage',
  children,
  ...props
}: React.ComponentProps<'section'> & { surface?: 'stage' | 'ivory' }) {
  return (
    <section
      data-surface={surface === 'ivory' ? 'ivory' : undefined}
      className={cn('bg-background text-foreground py-20 sm:py-28 lg:py-36', className)}
      {...props}
    >
      {children}
    </section>
  )
}

/** Eyebrow + condensed display title with an optional italic-serif accent word. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  accent,
  description,
  align = 'start',
  className,
  as: Tag = 'h2',
}: {
  index?: number
  eyebrow: string
  title: string
  accent?: string
  description?: string
  align?: 'start' | 'center'
  className?: string
  as?: 'h1' | 'h2'
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      <Reveal>
        <p className="type-eyebrow text-brand flex items-center gap-3">
          {index !== undefined && (
            <span className="font-mono tracking-normal">{String(index).padStart(2, '0')}</span>
          )}
          {index !== undefined && <span aria-hidden className="bg-brand/60 h-px w-8" />}
          {eyebrow}
        </p>
      </Reveal>
      <Tag className="type-display text-display-lg">
        <RevealLines
          lines={[
            title,
            ...(accent
              ? [
                  <span key="a" className="type-accent text-brand">
                    {accent}
                  </span>,
                ]
              : []),
          ]}
        />
      </Tag>
      {description && (
        <Reveal delay={0.15}>
          <p className="text-muted-foreground max-w-xl text-base sm:text-lg">{description}</p>
        </Reveal>
      )}
    </div>
  )
}
