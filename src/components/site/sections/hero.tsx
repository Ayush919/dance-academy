import Link from 'next/link'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal, RevealLines } from '@/components/motion/reveal'
import { Container } from './primitives'

export interface HeroContent {
  eyebrow: string
  lines: string[]
  accent?: string
  description: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  /** Optional background media. Video gets a poster and is skipped under reduced motion. */
  media?:
    { type: 'video'; src: string; poster: string } | { type: 'image'; src: string; alt: string }
}

/**
 * Full-screen opening section. Editorial condensed headline on a stage-lit canvas; with media it
 * becomes a cinematic video/image hero with a legibility gradient.
 */
export function Hero({ content }: { content: HeroContent }) {
  const { media } = content
  return (
    <section className="grain bg-background relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-28 sm:pt-32">
      {media?.type === 'video' && (
        <video
          className="absolute inset-0 -z-20 size-full object-cover motion-reduce:hidden"
          src={media.src}
          poster={media.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
      )}
      {media?.type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element -- replaced by next/image with the Cloudinary loader in Phase 4
        <img
          src={media.src}
          alt={media.alt}
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      )}
      {media && (
        <div
          aria-hidden
          className="from-background via-background/40 to-background/10 absolute inset-0 -z-10 bg-gradient-to-t"
        />
      )}

      {!media && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="animate-spotlight absolute -top-1/3 left-1/2 h-[140%] w-[90%] opacity-80 blur-2xl"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 0%, transparent 42%, color-mix(in oklch, var(--brand) 55%, transparent) 50%, transparent 58%)',
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                'radial-gradient(70% 60% at 50% 100%, color-mix(in oklch, var(--brand) 18%, transparent), transparent 70%)',
            }}
          />
        </div>
      )}

      <Container className="flex flex-1 flex-col justify-end pb-10 sm:pb-14">
        <Reveal>
          <p className="type-eyebrow text-foreground/70 mb-6">{content.eyebrow}</p>
        </Reveal>
        <h1 className="type-display text-display-2xl">
          <RevealLines
            lines={[
              ...content.lines,
              ...(content.accent
                ? [
                    <span key="accent" className="type-accent text-brand">
                      {content.accent}
                    </span>,
                  ]
                : []),
            ]}
          />
        </h1>

        <div className="mt-10 grid gap-8 sm:mt-14 lg:grid-cols-[1fr_auto] lg:items-end">
          <Reveal delay={0.35}>
            <p className="text-foreground/80 max-w-md text-base sm:text-lg">
              {content.description}
            </p>
          </Reveal>
          <Reveal delay={0.45} className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="brand" size="xl">
              <Link href={content.primaryCta.href}>
                {content.primaryCta.label} <ArrowUpRight />
              </Link>
            </Button>
            {content.secondaryCta && (
              <Button asChild variant="stage-outline" size="xl">
                <Link href={content.secondaryCta.href}>{content.secondaryCta.label}</Link>
              </Button>
            )}
          </Reveal>
        </div>

        <a
          href="#main-content"
          className="text-foreground/60 hover:text-foreground mt-12 hidden w-fit items-center gap-2 text-xs tracking-[0.28em] uppercase sm:inline-flex"
        >
          <ArrowDown className="size-4 motion-safe:animate-bounce" /> Scroll
        </a>
      </Container>
    </section>
  )
}
