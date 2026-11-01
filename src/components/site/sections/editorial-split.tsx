import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import { Container, Section, SectionHeading } from './primitives'

/**
 * Asymmetric text section: sticky heading on the left, body copy on the right. Used for the
 * academy story, philosophy and program introductions instead of repeated card grids.
 */
export function EditorialSplit({
  index,
  eyebrow,
  title,
  accent,
  body,
  cta,
  surface,
  aside,
}: {
  index?: number
  eyebrow: string
  title: string
  accent?: string
  body: string[]
  cta?: { label: string; href: string }
  surface?: 'stage' | 'ivory'
  /** Optional visual (image, video, stats) under the copy. */
  aside?: React.ReactNode
}) {
  return (
    <Section surface={surface}>
      <Container className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading index={index} eyebrow={eyebrow} title={title} accent={accent} />
        </div>
        <div className="flex flex-col gap-6 lg:pt-14">
          {body.map((p, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <p
                className={
                  i === 0
                    ? 'text-xl leading-relaxed sm:text-2xl'
                    : 'text-muted-foreground text-base leading-relaxed sm:text-lg'
                }
              >
                {p}
              </p>
            </Reveal>
          ))}
          {cta && (
            <Reveal delay={0.2}>
              <Button
                asChild
                variant={surface === 'ivory' ? 'default' : 'stage-outline'}
                size="xl"
                className="mt-4 w-fit"
              >
                <Link href={cta.href}>
                  {cta.label} <ArrowUpRight />
                </Link>
              </Button>
            </Reveal>
          )}
          {aside}
        </div>
      </Container>
    </Section>
  )
}
