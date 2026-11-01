import { Reveal, RevealLines } from '@/components/motion/reveal'
import { Container } from './sections/primitives'

/** Opening block for inner pages: editorial headline without the full-screen treatment. */
export function PageHero({
  eyebrow,
  lines,
  accent,
  description,
  children,
}: {
  eyebrow: string
  lines: string[]
  accent?: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <section className="grain relative isolate overflow-hidden pt-32 pb-14 sm:pt-40 sm:pb-20">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[120%]"
        style={{
          background:
            'radial-gradient(60% 50% at 15% 0%, color-mix(in oklch, var(--brand) 22%, transparent), transparent 70%)',
        }}
      />
      <Container>
        <Reveal>
          <p className="type-eyebrow text-brand mb-6">{eyebrow}</p>
        </Reveal>
        <h1 className="type-display text-display-xl">
          <RevealLines
            lines={[
              ...lines,
              ...(accent
                ? [
                    <span key="a" className="type-accent text-brand">
                      {accent}
                    </span>,
                  ]
                : []),
            ]}
          />
        </h1>
        {description && (
          <Reveal delay={0.2}>
            <p className="text-muted-foreground mt-8 max-w-2xl text-base sm:text-lg">
              {description}
            </p>
          </Reveal>
        )}
        {children && <div className="mt-10">{children}</div>}
      </Container>
    </section>
  )
}
