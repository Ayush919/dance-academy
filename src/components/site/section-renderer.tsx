import type { LinkRef, MediaRef, Section } from '@/content/schema'
import {
  getAcademyFacts,
  getCatalogue,
  getGallery,
  getPublicBranches,
  getPublicInstructors,
  getTestimonials,
  getUpcomingEvents,
} from '@/server/services/public'
import { faqJsonLd } from '@/server/services/seo'
import { JsonLd } from './json-ld'
import { PageHero } from './page-hero'
import { CtaBand } from './sections/cta-band'
import { EditorialSplit } from './sections/editorial-split'
import {
  FaqSection,
  GalleryTeaser,
  ImageText,
  RichText,
  VideoSection,
} from './sections/extra-sections'
import { Hero } from './sections/hero'
import {
  EventsSection,
  FactsStrip,
  FeaturedPrograms,
  InstructorsShowcase,
  LocationsSection,
  TestimonialsSection,
  WhyUs,
} from './sections/home-sections'
import { Marquee } from './sections/marquee'

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d)
const link = (v: unknown) => (v ?? { label: '', href: '' }) as LinkRef
const media = (v: unknown) => (v ?? { url: '', alt: '' }) as MediaRef
const usable = (l: LinkRef) => (l.label && l.href ? { label: l.label, href: l.href } : undefined)
const paragraphs = (body: string) =>
  body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
const heading = (s: Section) => ({
  eyebrow: str(s.eyebrow),
  title: str(s.title),
  accent: str(s.accent),
  description: str(s.description),
})

const NUMBERED = new Set([
  'story',
  'imageText',
  'why',
  'programs',
  'instructors',
  'events',
  'testimonials',
  'gallery',
  'locations',
  'faq',
])

/**
 * Renders a CMS page. Live sections fetch academy data (cached) only when present. Sections that
 * have nothing to show are skipped, and editorial numbering counts only what renders.
 */
export async function SectionRenderer({ sections }: { sections: Section[] }) {
  const visible = sections.filter((s) => !s.hidden)
  const needs = (...types: string[]) => visible.some((s) => types.includes(s.type))
  const [catalogue, instructors, events, testimonials, gallery, branches, facts] =
    await Promise.all([
      needs('programs') ? getCatalogue() : null,
      needs('instructors') ? getPublicInstructors() : null,
      needs('events') ? getUpcomingEvents() : null,
      needs('testimonials') ? getTestimonials() : null,
      needs('gallery') ? getGallery() : null,
      needs('locations') ? getPublicBranches() : null,
      needs('facts', 'marquee') ? getAcademyFacts() : null,
    ])

  const isEmpty = (s: Section) =>
    (s.type === 'programs' && !catalogue?.programs.length) ||
    (s.type === 'instructors' && !instructors?.length) ||
    (s.type === 'events' && !events?.some((e) => e.status === 'published')) ||
    (s.type === 'testimonials' && !testimonials?.length) ||
    (s.type === 'gallery' && !gallery?.length) ||
    (s.type === 'locations' && !branches?.length) ||
    (s.type === 'faq' && !(s.items as unknown[] | undefined)?.length)

  let n = 0
  const rendered = visible.filter((s) => !isEmpty(s))
  const idx = new Map(rendered.filter((s) => NUMBERED.has(s.type)).map((s) => [s.id, ++n]))

  return rendered.map((s) => {
    const i = idx.get(s.id) ?? 0
    const surface = (str(s.surface) || 'stage') as 'stage' | 'ivory'
    switch (s.type) {
      case 'hero': {
        const image = media(s.image)
        const videoUrl = str(s.videoUrl)
        return (
          <Hero
            key={s.id}
            content={{
              eyebrow: str(s.eyebrow),
              lines: (s.lines as string[]) ?? [],
              accent: str(s.accent) || undefined,
              description: str(s.description),
              primaryCta: usable(link(s.primaryCta)) ?? {
                label: 'Explore classes',
                href: '/programs',
              },
              secondaryCta: usable(link(s.secondaryCta)),
              media: videoUrl
                ? { type: 'video', src: videoUrl, poster: image.url }
                : image.url
                  ? { type: 'image', src: image.url, alt: image.alt }
                  : undefined,
            }}
          />
        )
      }
      case 'pageHero':
        return (
          <PageHero
            key={s.id}
            eyebrow={str(s.eyebrow)}
            lines={(s.lines as string[]) ?? []}
            accent={str(s.accent) || undefined}
            description={str(s.description) || undefined}
          />
        )
      case 'marquee': {
        const words =
          s.source === 'custom'
            ? ((s.words as string[]) ?? []).filter(Boolean)
            : (facts?.styles ?? [])
        return words.length ? <Marquee key={s.id} items={words} /> : null
      }
      case 'story': {
        const cta = usable(link(s.cta))
        return (
          <EditorialSplit
            key={s.id}
            index={i}
            eyebrow={str(s.eyebrow)}
            title={str(s.title)}
            accent={str(s.accent) || undefined}
            body={paragraphs(str(s.body))}
            cta={cta}
            surface={surface}
          />
        )
      }
      case 'imageText':
        return (
          <ImageText
            key={s.id}
            index={i}
            eyebrow={str(s.eyebrow)}
            title={str(s.title)}
            accent={str(s.accent)}
            body={str(s.body)}
            image={media(s.image)}
            imageSide={str(s.imageSide)}
            cta={link(s.cta)}
            surface={surface}
          />
        )
      case 'why':
        return (
          <WhyUs
            key={s.id}
            index={i}
            surface={surface}
            content={{
              eyebrow: str(s.eyebrow),
              title: str(s.title),
              accent: str(s.accent) || undefined,
              points: ((s.points as { title: string; body: string }[]) ?? []).filter(
                (p) => p.title,
              ),
            }}
          />
        )
      case 'facts':
        return facts ? <FactsStrip key={s.id} facts={facts} /> : null
      case 'programs': {
        const list = [...catalogue!.programs]
        if (s.mode !== 'all')
          list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder)
        return (
          <FeaturedPrograms
            key={s.id}
            index={i}
            programs={list}
            heading={heading(s)}
            limit={num(s.limit, 8)}
          />
        )
      }
      case 'instructors':
        return (
          <InstructorsShowcase
            key={s.id}
            index={i}
            instructors={instructors!}
            heading={heading(s)}
            limit={num(s.limit, 4)}
          />
        )
      case 'events':
        return (
          <EventsSection
            key={s.id}
            index={i}
            events={events!}
            heading={heading(s)}
            limit={num(s.limit, 3)}
          />
        )
      case 'testimonials':
        return (
          <TestimonialsSection
            key={s.id}
            index={i}
            items={testimonials!}
            heading={heading(s)}
            limit={num(s.limit, 6)}
          />
        )
      case 'gallery':
        return (
          <GalleryTeaser
            key={s.id}
            index={i}
            heading={{
              eyebrow: str(s.eyebrow) || 'Gallery',
              title: str(s.title) || 'Moments from',
              accent: str(s.accent) || undefined,
            }}
            items={gallery!.slice(0, num(s.limit, 6))}
          />
        )
      case 'locations':
        return <LocationsSection key={s.id} index={i} branches={branches!} heading={heading(s)} />
      case 'faq': {
        const items = ((s.items as { id: string; q: string; a: string }[]) ?? []).filter(
          (f) => f.q && f.a,
        )
        return (
          <div key={s.id}>
            <JsonLd data={faqJsonLd(items)} />
            <FaqSection
              index={i}
              eyebrow={str(s.eyebrow)}
              title={str(s.title)}
              accent={str(s.accent)}
              items={items}
            />
          </div>
        )
      }
      case 'text':
        return <RichText key={s.id} title={str(s.title)} body={str(s.body)} />
      case 'video':
        return (
          <VideoSection
            key={s.id}
            title={str(s.title)}
            youtubeUrl={str(s.youtubeUrl)}
            fileUrl={str(s.fileUrl)}
            poster={media(s.poster)}
          />
        )
      case 'cta': {
        const primary = usable(link(s.primaryCta))
        if (!primary) return null
        return (
          <CtaBand
            key={s.id}
            eyebrow={str(s.eyebrow)}
            title={str(s.title)}
            accent={str(s.accent) || undefined}
            description={str(s.description)}
            primaryCta={primary}
            secondaryCta={usable(link(s.secondaryCta))}
          />
        )
      }
      default:
        return null
    }
  })
}
