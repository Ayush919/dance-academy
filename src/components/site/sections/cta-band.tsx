import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal, RevealLines } from '@/components/motion/reveal'
import { Container } from './primitives'

/** Closing conversion section: one big statement, two clear actions. */
export function CtaBand({
  eyebrow,
  title,
  accent,
  description,
  primaryCta,
  secondaryCta,
}: {
  eyebrow: string
  title: string
  accent?: string
  description: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}) {
  return (
    <section className="grain bg-brand text-brand-foreground relative isolate overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="absolute -top-24 -right-24 -z-10 size-[28rem] rounded-full bg-[color-mix(in_oklch,var(--brand),white_18%)] blur-3xl"
      />
      <Container className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Reveal>
            <p className="type-eyebrow mb-6">{eyebrow}</p>
          </Reveal>
          <h2 className="type-display text-display-xl">
            <RevealLines
              lines={[
                title,
                ...(accent
                  ? [
                      <span key="a" className="type-accent">
                        {accent}
                      </span>,
                    ]
                  : []),
              ]}
            />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-md text-base sm:text-lg">{description}</p>
          </Reveal>
        </div>
        <Reveal delay={0.25} className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="xl" className="bg-ink text-ivory hover:bg-ink/85">
            <Link href={primaryCta.href}>
              {primaryCta.label} <ArrowUpRight />
            </Link>
          </Button>
          {secondaryCta && (
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-ink/30 text-ink hover:bg-ink/10 hover:text-ink bg-transparent"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          )}
        </Reveal>
      </Container>
    </section>
  )
}
