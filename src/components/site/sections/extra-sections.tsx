import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import type { LinkRef, MediaRef } from '@/content/schema'
import { cn } from '@/lib/utils'
import { youtubeId } from '@/lib/youtube'
import { StageImage } from '../stage-image'
import { Container, Section, SectionHeading } from './primitives'

export function ImageText({
  index,
  eyebrow,
  title,
  accent,
  body,
  image,
  imageSide,
  cta,
  surface,
}: {
  index: number
  eyebrow: string
  title: string
  accent: string
  body: string
  image: MediaRef
  imageSide: string
  cta: LinkRef
  surface: 'stage' | 'ivory'
}) {
  return (
    <Section surface={surface}>
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal
          className={cn(
            imageSide === 'left' && 'lg:order-first',
            imageSide !== 'left' && 'lg:order-last',
          )}
        >
          <StageImage
            src={image.url}
            alt={image.alt}
            label={title || eyebrow}
            className="aspect-[4/5]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        </Reveal>
        <div className="flex flex-col gap-6">
          <SectionHeading
            index={index || undefined}
            eyebrow={eyebrow}
            title={title}
            accent={accent || undefined}
          />
          {paragraphs(body).map((p, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <p className="text-muted-foreground text-lg leading-relaxed">{p}</p>
            </Reveal>
          ))}
          {cta.href && cta.label && (
            <Button
              asChild
              variant={surface === 'ivory' ? 'default' : 'stage-outline'}
              size="xl"
              className="w-fit"
            >
              <Link href={cta.href}>
                {cta.label} <ArrowUpRight />
              </Link>
            </Button>
          )}
        </div>
      </Container>
    </Section>
  )
}

export function FaqSection({
  index,
  eyebrow,
  title,
  accent,
  items,
}: {
  index: number
  eyebrow: string
  title: string
  accent: string
  items: { id: string; q: string; a: string }[]
}) {
  if (!items.length) return null
  return (
    <Section id="faq" surface="ivory">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <SectionHeading
          index={index || undefined}
          eyebrow={eyebrow}
          title={title}
          accent={accent || undefined}
        />
        <Accordion type="single" collapsible className="w-full">
          {items.map((f) => (
            <AccordionItem key={f.id} value={f.id} className="border-foreground/12">
              <AccordionTrigger className="py-5 text-left text-lg font-medium">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 text-base leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  )
}

const paragraphs = (body: string) =>
  body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

/**
 * Long-form text with a tiny, safe markup: "## " headings, "- " list items, blank-line paragraphs.
 * Rendered as React elements (never as HTML), so content can't inject markup.
 */
export function RichText({ title, body }: { title: string; body: string }) {
  const blocks = paragraphs(body)
  return (
    <Section className="pt-0 sm:pt-0 lg:pt-0">
      <Container className="max-w-3xl">
        {title && <h2 className="type-display mb-8 text-4xl">{title}</h2>}
        <div className="flex flex-col gap-5 text-lg leading-relaxed">
          {blocks.map((b, i) => {
            if (b.startsWith('## '))
              return (
                <h3 key={i} className="type-display mt-6 text-2xl">
                  {b.slice(3)}
                </h3>
              )
            const lines = b.split('\n')
            if (lines.every((l) => l.startsWith('- '))) {
              return (
                <ul key={i} className="text-muted-foreground list-disc space-y-2 pl-6">
                  {lines.map((l, j) => (
                    <li key={j}>{l.slice(2)}</li>
                  ))}
                </ul>
              )
            }
            return (
              <p key={i} className="text-muted-foreground">
                {b}
              </p>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}

export function VideoSection({
  title,
  youtubeUrl,
  fileUrl,
  poster,
}: {
  title: string
  youtubeUrl: string
  fileUrl: string
  poster: MediaRef
}) {
  const yt = youtubeUrl ? youtubeId(youtubeUrl) : null
  if (!yt && !fileUrl) return null
  return (
    <Section>
      <Container className="flex flex-col gap-8">
        {title && <h2 className="type-display text-display-md">{title}</h2>}
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          {yt ? (
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              title={title || 'Video'}
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              className="size-full"
              src={fileUrl}
              poster={poster.url || undefined}
              controls
              preload="metadata"
              playsInline
            />
          )}
        </div>
      </Container>
    </Section>
  )
}

export function GalleryTeaser({
  index,
  heading,
  items,
}: {
  index: number
  heading: { eyebrow: string; title: string; accent?: string }
  items: {
    id: string
    kind: string
    src: string | null
    poster: string | null
    youtubeId: string | null
    alt: string
    category: string
  }[]
}) {
  if (!items.length) return null
  return (
    <Section>
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading index={index || undefined} {...heading} />
          <Button asChild variant="stage-outline" className="rounded-full">
            <Link href="/gallery">
              Open the gallery <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((g, i) => (
            <li key={g.id} className={cn(i === 0 && 'md:col-span-2 md:row-span-2')}>
              <Link href="/gallery" className="group block">
                <StageImage
                  src={
                    g.kind === 'video'
                      ? (g.poster ??
                        (g.youtubeId
                          ? `https://i.ytimg.com/vi/${g.youtubeId}/hqdefault.jpg`
                          : null))
                      : g.src
                  }
                  alt={g.alt}
                  label={g.category}
                  className={i === 0 ? 'aspect-square' : 'aspect-[4/3]'}
                />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}
