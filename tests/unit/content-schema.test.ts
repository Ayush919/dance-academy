import { describe, expect, it } from 'vitest'
import {
  brandForeground,
  contrast,
  DATA_SCHEMAS,
  isValidHref,
  newSection,
  publishIssues,
  summariseChanges,
} from '@/content/schema'
import { DEFAULT_BRAND, DEFAULT_NAVIGATION, DEFAULT_SEO, HOME_PAGE } from '@/content/seed-content'
import { sniff } from '@/server/lib/file-sniff'
import { youtubeId } from '@/lib/youtube'
import { galleryItemInput, testimonialSubmission } from '@/server/validators/website'

const page = (sections: unknown[], extra: Record<string, unknown> = {}) =>
  DATA_SCHEMAS.page.parse({ title: 'Camp', sections, ...extra })

describe('content schema', () => {
  it('ships seed content that is ready to publish', () => {
    expect(publishIssues('page', HOME_PAGE)).toEqual([])
    expect(publishIssues('navigation', DEFAULT_NAVIGATION)).toEqual([])
    expect(publishIssues('brand', DEFAULT_BRAND)).toEqual([])
    expect(publishIssues('seo', DEFAULT_SEO)).toEqual([])
  })

  it('blocks publishing missing required fields, alt text and bad links — but ignores hidden sections', () => {
    const hero = { ...newSection('hero', 'h1'), lines: [], image: { url: '/a.jpg', alt: '' } }
    const cta = {
      ...newSection('cta', 'c1'),
      primaryCta: { label: 'Go', href: 'javascript:alert(1)' },
    }
    const issues = publishIssues('page', page([hero, cta]))
    const text = issues.map((i) => i.message).join('\n')
    expect(text).toMatch(/section 1/)
    expect(text).toMatch(/alt text/)
    expect(text).toMatch(/valid link/)
    expect(
      publishIssues(
        'page',
        page([
          { ...hero, hidden: true },
          { ...cta, hidden: true },
        ]),
      ),
    ).toContainEqual(expect.objectContaining({ path: 'sections' }))
  })

  it('rejects unknown section types and script-y data outright', () => {
    expect(
      DATA_SCHEMAS.page.safeParse({ title: 'X', sections: [{ id: 'a', type: 'iframe' }] }).success,
    ).toBe(false)
  })

  it('accepts only safe link targets', () => {
    for (const ok of ['/programs', '#faq', 'mailto:a@b.co', 'tel:+9198', 'https://x.com'])
      expect(isValidHref(ok)).toBe(true)
    for (const bad of ['javascript:alert(1)', '//evil.com', 'http://evil.com', 'data:text/html,x'])
      expect(isValidHref(bad)).toBe(false)
  })

  it('checks brand colour contrast both ways (WCAG)', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(brandForeground('#FF4A2B')).toBe('#0B0B0C')
    expect(brandForeground('#1D3B8B')).toBe('#F5F2EC')
    const muddy = { ...DEFAULT_BRAND, brandColor: '#777777' }
    expect(publishIssues('brand', muddy).map((i) => i.path)).toContain('brandColor')
    const dark = { ...DEFAULT_BRAND, brandColor: '#1D3B8B' }
    expect(publishIssues('brand', dark).some((i) => /too dark/.test(i.message))).toBe(true)
  })

  it('requires %s in the SEO title template', () => {
    expect(publishIssues('seo', { ...DEFAULT_SEO, titleTemplate: 'Remo' })[0]?.path).toBe(
      'titleTemplate',
    )
  })

  it('summarises section-level changes for the publish dialog', () => {
    const a = page([{ ...newSection('faq', 'f'), title: 'Questions' }])
    const b = page([{ ...newSection('faq', 'f'), title: 'Answers' }, newSection('cta', 'c')])
    expect(summariseChanges(null, a)).toEqual(['First publication'])
    const changes = summariseChanges(a, b).join(' | ')
    expect(changes).toMatch(/Added/)
    expect(changes).toMatch(/Edited|Changed/)
  })
})

describe('uploads and links', () => {
  const bytes = (...parts: (number[] | string)[]) =>
    new Uint8Array(
      parts
        .flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p))
        .concat(Array(16).fill(0)),
    )

  it('identifies files by content, not name', () => {
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg')
    expect(sniff(bytes([0x89], 'PNG'))?.mime).toBe('image/png')
    expect(sniff(bytes('RIFF', [0, 0, 0, 0], 'WEBP'))?.mime).toBe('image/webp')
    expect(sniff(bytes([0, 0, 0, 0x18], 'ftypisom'))?.kind).toBe('video')
  })

  it('refuses SVG, HTML and unknown files', () => {
    expect(sniff(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
    expect(sniff(bytes('<!doctype html><script>'))).toBeNull()
    expect(sniff(bytes('PK'))).toBeNull()
  })

  it('reads YouTube ids from every common link shape', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=3',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ])
      expect(youtubeId(url)).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://vimeo.com/123')).toBeNull()
  })

  it('validates gallery items and public stories', () => {
    expect(
      galleryItemInput.safeParse({ kind: 'image', alt: 'Show', category: 'events' }).success,
    ).toBe(false)
    expect(
      galleryItemInput.parse({
        kind: 'video',
        youtube: 'https://youtu.be/dQw4w9WgXcQ',
        alt: 'Show',
        category: 'events',
      }).youtube,
    ).toBe('dQw4w9WgXcQ')
    expect(
      galleryItemInput.safeParse({
        kind: 'image',
        src: 'javascript:x',
        alt: 'Show',
        category: 'events',
      }).success,
    ).toBe(false)
    const story = {
      authorName: 'Asha',
      relation: 'parent',
      quote: 'My daughter loves every class here.',
      consent: true,
    }
    expect(testimonialSubmission.safeParse(story).success).toBe(true)
    expect(testimonialSubmission.safeParse({ ...story, consent: false }).success).toBe(false)
  })
})
