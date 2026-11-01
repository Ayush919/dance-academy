import { z } from 'zod'

/**
 * Website content model. Field definitions drive BOTH the editor UI and validation, so a section
 * type is defined once here. Client-safe: no server imports.
 *
 * Drafts only need to be structurally valid (strings may be empty). `publishIssues()` applies the
 * stricter rules (required fields, alt text, links, colour contrast) before anything goes live.
 */

// ── Field definitions ───────────────────────────────────────────────────

export type FieldDef =
  | {
      kind: 'text'
      name: string
      label: string
      required?: boolean
      max?: number
      help?: string
      placeholder?: string
      /** Offer site paths (pages, programs…) as suggestions. */
      suggestLinks?: boolean
    }
  | { kind: 'color'; name: string; label: string; help?: string }
  | {
      kind: 'textarea'
      name: string
      label: string
      required?: boolean
      max?: number
      help?: string
      rows?: number
    }
  | { kind: 'number'; name: string; label: string; min: number; max: number; help?: string }
  | { kind: 'switch'; name: string; label: string; help?: string }
  | {
      kind: 'select'
      name: string
      label: string
      options: { value: string; label: string }[]
      help?: string
    }
  | { kind: 'image'; name: string; label: string; required?: boolean; help?: string }
  | { kind: 'link'; name: string; label: string; required?: boolean; help?: string }
  | { kind: 'lines'; name: string; label: string; required?: boolean; help?: string; max?: number }
  | {
      kind: 'list'
      name: string
      label: string
      itemLabel: string
      fields: FieldDef[]
      min?: number
      max?: number
      help?: string
    }

export const mediaRef = z.object({
  url: z.string().max(2000).default(''),
  alt: z.string().max(300).default(''),
  assetId: z.string().max(64).optional(),
})
export type MediaRef = z.infer<typeof mediaRef>

export const linkRef = z.object({
  label: z.string().max(60).default(''),
  href: z.string().max(500).default(''),
})
export type LinkRef = z.infer<typeof linkRef>

function fieldZod(f: FieldDef): z.ZodType {
  switch (f.kind) {
    case 'text':
      return z
        .string()
        .max(f.max ?? 200)
        .default('')
    case 'textarea':
      return z
        .string()
        .max(f.max ?? 6000)
        .default('')
    case 'number':
      return z.coerce.number().int().min(f.min).max(f.max).default(f.min)
    case 'switch':
      return z.boolean().default(false)
    case 'color':
      return z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default('#FF4A2B')
    case 'select':
      return z
        .enum(f.options.map((o) => o.value) as [string, ...string[]])
        .default(f.options[0]!.value)
    case 'image':
      return mediaRef.default({ url: '', alt: '' })
    case 'link':
      return linkRef.default({ label: '', href: '' })
    case 'lines':
      return z
        .array(z.string().max(200))
        .max(f.max ?? 30)
        .default([])
    case 'list':
      return z
        .array(
          z.object({
            id: z.string().max(40),
            ...Object.fromEntries(f.fields.map((s) => [s.name, fieldZod(s)])),
          }),
        )
        .max(f.max ?? 30)
        .default([])
  }
}

// ── Section types ───────────────────────────────────────────────────────

const heading = (
  defaults: { eyebrow?: string; title?: string; accent?: string } = {},
): FieldDef[] => [
  { kind: 'text', name: 'eyebrow', label: 'Eyebrow', max: 60, placeholder: defaults.eyebrow },
  {
    kind: 'text',
    name: 'title',
    label: 'Title',
    required: true,
    max: 80,
    placeholder: defaults.title,
  },
  {
    kind: 'text',
    name: 'accent',
    label: 'Accent words (italic)',
    max: 60,
    help: 'Shown on a new line in the accent style.',
  },
]
const surface: FieldDef = {
  kind: 'select',
  name: 'surface',
  label: 'Background',
  options: [
    { value: 'stage', label: 'Dark' },
    { value: 'ivory', label: 'Light' },
  ],
}
const limit = (n: number): FieldDef => ({
  kind: 'number',
  name: 'limit',
  label: 'How many to show',
  min: 1,
  max: n,
})

export interface SectionDef {
  label: string
  description: string
  group: 'Opening' | 'Story' | 'Live data' | 'Conversion' | 'Content'
  /** Pulls programs, instructors, events… from the academy's data. */
  live?: boolean
  fields: FieldDef[]
}

export const SECTION_DEFS = {
  hero: {
    label: 'Hero',
    description: 'Full-screen opening with headline, buttons and optional photo or video.',
    group: 'Opening',
    fields: [
      { kind: 'text', name: 'eyebrow', label: 'Eyebrow', max: 80 },
      {
        kind: 'lines',
        name: 'lines',
        label: 'Headline lines',
        required: true,
        max: 4,
        help: 'One line per entry, set large in capitals.',
      },
      { kind: 'text', name: 'accent', label: 'Accent words (italic)', max: 60 },
      { kind: 'textarea', name: 'description', label: 'Description', max: 300, rows: 3 },
      { kind: 'link', name: 'primaryCta', label: 'Main button', required: true },
      { kind: 'link', name: 'secondaryCta', label: 'Second button' },
      {
        kind: 'image',
        name: 'image',
        label: 'Background photo',
        help: 'Used when there is no video, and as the video poster.',
      },
      {
        kind: 'text',
        name: 'videoUrl',
        label: 'Background video URL (MP4)',
        max: 500,
        help: 'Muted, looping. Skipped for visitors who prefer reduced motion.',
      },
    ],
  },
  pageHero: {
    label: 'Page header',
    description: 'Headline block for inner pages.',
    group: 'Opening',
    fields: [
      { kind: 'text', name: 'eyebrow', label: 'Eyebrow', max: 60 },
      { kind: 'lines', name: 'lines', label: 'Headline lines', required: true, max: 3 },
      { kind: 'text', name: 'accent', label: 'Accent words (italic)', max: 60 },
      { kind: 'textarea', name: 'description', label: 'Description', max: 400, rows: 3 },
    ],
  },
  marquee: {
    label: 'Ticker',
    description: 'A slow scrolling line of words — your dance styles, or your own.',
    group: 'Opening',
    fields: [
      {
        kind: 'select',
        name: 'source',
        label: 'Words',
        options: [
          { value: 'styles', label: 'Dance styles (automatic)' },
          { value: 'custom', label: 'My own words' },
        ],
      },
      { kind: 'lines', name: 'words', label: 'Custom words', max: 12 },
    ],
  },
  story: {
    label: 'Story',
    description: 'Headline on one side, paragraphs on the other.',
    group: 'Story',
    fields: [
      ...heading(),
      {
        kind: 'textarea',
        name: 'body',
        label: 'Text',
        required: true,
        max: 4000,
        rows: 6,
        help: 'Separate paragraphs with a blank line.',
      },
      { kind: 'link', name: 'cta', label: 'Button' },
      surface,
    ],
  },
  imageText: {
    label: 'Image & text',
    description: 'A photo beside a short story.',
    group: 'Story',
    fields: [
      ...heading(),
      { kind: 'textarea', name: 'body', label: 'Text', required: true, max: 3000, rows: 5 },
      { kind: 'image', name: 'image', label: 'Image', required: true },
      {
        kind: 'select',
        name: 'imageSide',
        label: 'Image position',
        options: [
          { value: 'right', label: 'Right' },
          { value: 'left', label: 'Left' },
        ],
      },
      { kind: 'link', name: 'cta', label: 'Button' },
      surface,
    ],
  },
  why: {
    label: 'Numbered points',
    description: 'Reasons to choose you, or steps — numbered and editorial.',
    group: 'Story',
    fields: [
      ...heading(),
      {
        kind: 'list',
        name: 'points',
        label: 'Points',
        itemLabel: 'Point',
        min: 1,
        max: 8,
        fields: [
          { kind: 'text', name: 'title', label: 'Title', required: true, max: 60 },
          { kind: 'textarea', name: 'body', label: 'Text', max: 300, rows: 2 },
        ],
      },
      surface,
    ],
  },
  facts: {
    label: 'Numbers',
    description: 'Classes per week, programs, instructors and studios — counted automatically.',
    group: 'Live data',
    live: true,
    fields: [],
  },
  programs: {
    label: 'Programs',
    description: 'Program cards from your published catalogue.',
    group: 'Live data',
    live: true,
    fields: [
      ...heading(),
      { kind: 'textarea', name: 'description', label: 'Description', max: 300, rows: 2 },
      {
        kind: 'select',
        name: 'mode',
        label: 'Which programs',
        options: [
          { value: 'featured', label: 'Featured first' },
          { value: 'all', label: 'All, in order' },
        ],
      },
      limit(12),
    ],
  },
  instructors: {
    label: 'Instructors',
    description: 'Instructor cards from public profiles.',
    group: 'Live data',
    live: true,
    fields: [...heading(), limit(8)],
  },
  events: {
    label: 'Events',
    description: 'Upcoming published events.',
    group: 'Live data',
    live: true,
    fields: [
      ...heading(),
      { kind: 'textarea', name: 'description', label: 'Description', max: 300, rows: 2 },
      limit(6),
    ],
  },
  testimonials: {
    label: 'Testimonials',
    description: 'Approved reviews. Hidden while there are none.',
    group: 'Live data',
    live: true,
    fields: [...heading(), limit(9)],
  },
  gallery: {
    label: 'Gallery preview',
    description: 'Latest published photos and videos.',
    group: 'Live data',
    live: true,
    fields: [...heading(), limit(9)],
  },
  locations: {
    label: 'Studios',
    description: 'Your branches with addresses and phone numbers.',
    group: 'Live data',
    live: true,
    fields: heading(),
  },
  faq: {
    label: 'FAQ',
    description: 'Questions and answers (also published for search engines).',
    group: 'Content',
    fields: [
      ...heading(),
      {
        kind: 'list',
        name: 'items',
        label: 'Questions',
        itemLabel: 'Question',
        min: 1,
        max: 20,
        fields: [
          { kind: 'text', name: 'q', label: 'Question', required: true, max: 160 },
          { kind: 'textarea', name: 'a', label: 'Answer', required: true, max: 1000, rows: 3 },
        ],
      },
    ],
  },
  text: {
    label: 'Text',
    description: 'Long-form text for policies and articles. Supports ## headings and - lists.',
    group: 'Content',
    fields: [
      { kind: 'text', name: 'title', label: 'Title', max: 120 },
      {
        kind: 'textarea',
        name: 'body',
        label: 'Text',
        required: true,
        max: 30000,
        rows: 14,
        help: 'Blank line between paragraphs. Start a line with "## " for a heading or "- " for a list item.',
      },
    ],
  },
  video: {
    label: 'Video',
    description: 'A YouTube video or an MP4 file.',
    group: 'Content',
    fields: [
      { kind: 'text', name: 'title', label: 'Title', max: 120 },
      { kind: 'text', name: 'youtubeUrl', label: 'YouTube link', max: 300 },
      { kind: 'text', name: 'fileUrl', label: 'Or an MP4 link', max: 500 },
      { kind: 'image', name: 'poster', label: 'Poster image' },
    ],
  },
  cta: {
    label: 'Call to action',
    description: 'A bold closing band with one or two buttons.',
    group: 'Conversion',
    fields: [
      ...heading(),
      { kind: 'textarea', name: 'description', label: 'Description', max: 300, rows: 2 },
      { kind: 'link', name: 'primaryCta', label: 'Main button', required: true },
      { kind: 'link', name: 'secondaryCta', label: 'Second button' },
    ],
  },
} satisfies Record<string, SectionDef>

export type SectionType = keyof typeof SECTION_DEFS
export const SECTION_TYPES = Object.keys(SECTION_DEFS) as SectionType[]

const sectionSchemas = SECTION_TYPES.map((type) =>
  z.object({
    id: z.string().min(1).max(40),
    type: z.literal(type),
    hidden: z.boolean().default(false),
    ...Object.fromEntries(
      (SECTION_DEFS[type].fields as FieldDef[]).map((f) => [f.name, fieldZod(f)]),
    ),
  }),
)
/** Loose runtime shape for rendering (fields vary by type). */
export type Section = { id: string; type: SectionType; hidden: boolean } & Record<string, unknown>

// Built from the field definitions above; typed loosely because fields vary per section type.
export const sectionSchema = z.discriminatedUnion(
  'type',
  sectionSchemas as unknown as [z.ZodObject<{ type: z.ZodLiteral<SectionType> }>],
) as unknown as z.ZodType<Section, unknown>

/** A new section of `type` with every field at its default. */
export function newSection(type: SectionType, id: string): Section {
  return sectionSchema.parse({ id, type }) as Section
}

// ── Documents ───────────────────────────────────────────────────────────

export const CONTENT_KINDS = ['page', 'navigation', 'brand', 'seo'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

export const pageData = z.object({
  title: z.string().max(120).default(''),
  seo: z
    .object({
      title: z.string().max(70).default(''),
      description: z.string().max(170).default(''),
      image: mediaRef.default({ url: '', alt: '' }),
      noindex: z.boolean().default(false),
    })
    .default({ title: '', description: '', image: { url: '', alt: '' }, noindex: false }),
  sections: z.array(sectionSchema).max(40).default([]),
})
export type PageData = z.infer<typeof pageData>

export const navLink = z.object({
  id: z.string().max(40),
  label: z.string().max(40).default(''),
  href: z.string().max(500).default(''),
  newTab: z.boolean().default(false),
  enabled: z.boolean().default(true),
})
export type NavLink = z.infer<typeof navLink>

export const navigationData = z.object({
  header: z.array(navLink).max(10).default([]),
  footer: z.array(navLink).max(20).default([]),
  headerCta: linkRef.default({ label: 'Book a trial', href: '/book-trial' }),
})
export type NavigationData = z.infer<typeof navigationData>

export const FONT_PAIRINGS = [
  { value: 'editorial', label: 'Editorial — condensed sans + italic serif accents' },
  { value: 'modern', label: 'Modern — condensed sans throughout' },
] as const

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #FF4A2B')

export const brandData = z.object({
  academyName: z.string().max(80).default('Remo Dance Company'),
  tagline: z.string().max(160).default(''),
  logo: mediaRef.default({ url: '', alt: '' }),
  favicon: mediaRef.default({ url: '', alt: '' }),
  brandColor: hex.default('#FF4A2B'),
  fontPairing: z.enum(['editorial', 'modern']).default('editorial'),
  contact: z
    .object({
      email: z.string().max(254).default(''),
      phone: z.string().max(30).default(''),
      whatsapp: z.string().max(30).default(''),
    })
    .default({ email: '', phone: '', whatsapp: '' }),
  socials: z
    .object({
      instagram: z.string().max(300).default(''),
      youtube: z.string().max(300).default(''),
      facebook: z.string().max(300).default(''),
      x: z.string().max(300).default(''),
    })
    .default({ instagram: '', youtube: '', facebook: '', x: '' }),
  whatsappCta: z
    .object({
      enabled: z.boolean().default(true),
      message: z.string().max(300).default('Hi! I’d like to know more about your dance classes.'),
    })
    .default({ enabled: true, message: 'Hi! I’d like to know more about your dance classes.' }),
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().max(160).default(''),
      href: z.string().max(500).default(''),
    })
    .default({ enabled: false, text: '', href: '' }),
})
export type BrandData = z.infer<typeof brandData>

export const seoData = z.object({
  titleTemplate: z.string().max(80).default('%s · Remo Dance Company'),
  defaultTitle: z.string().max(70).default('Remo Dance Company'),
  defaultDescription: z.string().max(170).default(''),
  image: mediaRef.default({ url: '', alt: '' }),
  indexing: z.boolean().default(true),
  googleVerification: z.string().max(100).default(''),
})
export type SeoData = z.infer<typeof seoData>

export const DATA_SCHEMAS = {
  page: pageData,
  navigation: navigationData,
  brand: brandData,
  seo: seoData,
} as const

// ── Publish rules ───────────────────────────────────────────────────────

export interface PublishIssue {
  path: string
  message: string
}

const isEmpty = (v: unknown) =>
  v == null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.filter((x) => String(x).trim()).length === 0)

/** Internal paths, anchors, mailto/tel/WhatsApp and absolute https links are allowed. */
export function isValidHref(href: string) {
  return /^(\/(?!\/)|#|mailto:|tel:|https:\/\/|http:\/\/localhost)/.test(href.trim())
}

function checkFields(
  fields: FieldDef[],
  value: Record<string, unknown>,
  at: string,
  out: PublishIssue[],
) {
  for (const f of fields) {
    const v = value[f.name]
    const path = `${at}${f.name}`
    if (f.kind === 'link') {
      const l = v as LinkRef | undefined
      if (f.required && (isEmpty(l?.label) || isEmpty(l?.href)))
        out.push({ path, message: `${f.label}: add a label and a link` })
      else if (l?.href && !isValidHref(l.href))
        out.push({ path, message: `${f.label}: “${l.href}” isn’t a valid link` })
      else if (l?.href && isEmpty(l.label))
        out.push({ path, message: `${f.label}: add a button label` })
    } else if (f.kind === 'image') {
      const m = v as MediaRef | undefined
      if (f.required && isEmpty(m?.url)) out.push({ path, message: `${f.label}: choose an image` })
      if (m?.url && isEmpty(m.alt))
        out.push({ path, message: `${f.label}: describe the image for screen readers (alt text)` })
    } else if (f.kind === 'list') {
      const items = (v as Record<string, unknown>[] | undefined) ?? []
      if (f.min && items.length < f.min)
        out.push({ path, message: `${f.label}: add at least ${f.min}` })
      items.forEach((item, i) => checkFields(f.fields, item, `${path}.${i}.`, out))
    } else if ('required' in f && f.required && isEmpty(v)) {
      out.push({ path, message: `${f.label} is required` })
    }
  }
}

/** Everything that must be fixed before a document can go live. */
export function publishIssues(kind: ContentKind, data: unknown): PublishIssue[] {
  const parsed = DATA_SCHEMAS[kind].safeParse(data)
  if (!parsed.success)
    return parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
  const out: PublishIssue[] = []
  if (kind === 'page') {
    const d = parsed.data as PageData
    if (isEmpty(d.title)) out.push({ path: 'title', message: 'Page title is required' })
    if (d.seo.image.url && isEmpty(d.seo.image.alt))
      out.push({ path: 'seo.image', message: 'Share image: add alt text' })
    d.sections.forEach((s, i) => {
      if (s.hidden) return
      const def = SECTION_DEFS[s.type]
      const before = out.length
      checkFields(def.fields as FieldDef[], s as Record<string, unknown>, `sections.${i}.`, out)
      for (let k = before; k < out.length; k++)
        out[k]!.message = `${def.label} (section ${i + 1}): ${out[k]!.message}`
    })
    if (!d.sections.some((s) => !s.hidden))
      out.push({ path: 'sections', message: 'Add at least one visible section' })
  }
  if (kind === 'navigation') {
    const d = parsed.data as NavigationData
    for (const [where, list] of [
      ['Header', d.header],
      ['Footer', d.footer],
    ] as const) {
      list.forEach((l, i) => {
        if (!l.enabled) return
        if (isEmpty(l.label))
          out.push({
            path: `${where.toLowerCase()}.${i}.label`,
            message: `${where} link ${i + 1}: add a label`,
          })
        if (!isValidHref(l.href))
          out.push({
            path: `${where.toLowerCase()}.${i}.href`,
            message: `${where} link ${i + 1}: “${l.href}” isn’t a valid link`,
          })
      })
    }
  }
  if (kind === 'brand') {
    const d = parsed.data as BrandData
    const fg = brandForeground(d.brandColor)
    if (!fg)
      out.push({
        path: 'brandColor',
        message:
          'Brand colour is too mid-toned: neither dark nor light text on it reaches 4.5:1 contrast',
      })
    if (contrast(d.brandColor, '#0B0B0C') < 3)
      out.push({
        path: 'brandColor',
        message: 'Brand colour is too dark to stand out on the dark website background (needs 3:1)',
      })
    if (d.logo.url && isEmpty(d.logo.alt)) out.push({ path: 'logo', message: 'Logo: add alt text' })
    if (d.announcement.enabled && isEmpty(d.announcement.text))
      out.push({ path: 'announcement.text', message: 'Announcement: add the text' })
    if (d.announcement.href && !isValidHref(d.announcement.href))
      out.push({ path: 'announcement.href', message: 'Announcement: invalid link' })
  }
  if (kind === 'seo') {
    const d = parsed.data as SeoData
    if (!d.titleTemplate.includes('%s'))
      out.push({
        path: 'titleTemplate',
        message: 'Title template must contain %s where the page title goes',
      })
    if (d.image.url && isEmpty(d.image.alt))
      out.push({ path: 'image', message: 'Share image: add alt text' })
  }
  return out
}

// ── Colour contrast (WCAG 2.x) ──────────────────────────────────────────

function luminance(hexColor: string) {
  const n = parseInt(hexColor.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Text colour for buttons on the brand colour: ink if it reads well, ivory otherwise, null if neither does. */
export function brandForeground(brandColor: string): '#0B0B0C' | '#F5F2EC' | null {
  if (contrast(brandColor, '#0B0B0C') >= 4.5) return '#0B0B0C'
  if (contrast(brandColor, '#F5F2EC') >= 4.5) return '#F5F2EC'
  return null
}

/** Section-level summary of what changed between two page versions, for the publish dialog. */
export function summariseChanges(before: PageData | null, after: PageData): string[] {
  if (!before) return ['First publication']
  const out: string[] = []
  const label = (s: Section) =>
    `${SECTION_DEFS[s.type].label}${typeof s.title === 'string' && s.title ? ` “${s.title}”` : ''}`
  const prev = new Map(before.sections.map((s) => [s.id, s as Section]))
  const next = new Map(after.sections.map((s) => [s.id, s as Section]))
  for (const [id, s] of next) {
    const old = prev.get(id)
    if (!old) out.push(`Added ${label(s)}`)
    else if (JSON.stringify(old) !== JSON.stringify(s))
      out.push(
        old.hidden !== s.hidden
          ? `${s.hidden ? 'Hid' : 'Showed'} ${label(s)}`
          : `Edited ${label(s)}`,
      )
  }
  for (const [id, s] of prev) if (!next.has(id)) out.push(`Removed ${label(s)}`)
  const order = (d: PageData) =>
    d.sections
      .map((s) => s.id)
      .filter((id) => prev.has(id) && next.has(id))
      .join()
  if (order(before) !== order(after)) out.push('Reordered sections')
  if (before.title !== after.title) out.push('Changed the page title')
  if (JSON.stringify(before.seo) !== JSON.stringify(after.seo)) out.push('Changed search settings')
  return out.length ? out : ['No changes']
}
