import {
  brandData,
  navigationData,
  pageData,
  seoData,
  type BrandData,
  type NavigationData,
  type PageData,
  type SeoData,
} from './schema'
import {
  DEFAULT_ABOUT,
  DEFAULT_FAQ,
  DEFAULT_FINAL_CTA,
  DEFAULT_FOOTER_LINKS,
  DEFAULT_HERO,
  DEFAULT_INTRO,
  DEFAULT_SITE_NAV,
  DEFAULT_WHY,
} from './defaults'

/**
 * Starting content for a new academy. Seeded as published documents so the site works on day one;
 * from then on everything here is edited in the dashboard. Also the fallback if a document is missing.
 */

const link = (l: { label: string; href: string }) => ({ label: l.label, href: l.href })

export const DEFAULT_NAVIGATION: NavigationData = navigationData.parse({
  header: DEFAULT_SITE_NAV.map((l, i) => ({
    id: `h${i}`,
    label: l.label,
    href: l.href,
    newTab: false,
    enabled: true,
  })),
  footer: [
    ...DEFAULT_SITE_NAV,
    ...DEFAULT_FOOTER_LINKS,
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ].map((l, i) => ({ id: `f${i}`, label: l.label, href: l.href, newTab: false, enabled: true })),
  headerCta: { label: 'Book a trial', href: '/book-trial' },
})

export const DEFAULT_BRAND: BrandData = brandData.parse({
  academyName: 'Remo Dance Company',
  tagline: 'Dance training for every age and level, from first class to first performance.',
  contact: {
    email: 'hello@remodance.example',
    phone: '+91 98200 00000',
    whatsapp: '+919820000000',
  },
})

export const DEFAULT_SEO: SeoData = seoData.parse({
  titleTemplate: '%s · Remo Dance Company',
  defaultTitle: 'Remo Dance Company — Dance classes in Mumbai & Pune',
  defaultDescription:
    'Hip-hop, Bollywood, contemporary, jazz and more for every age and level. Structured training, real stages, and a free trial class at a studio near you.',
})

const paragraphs = (body: string[]) => body.join('\n\n')

export const HOME_PAGE: PageData = pageData.parse({
  title: 'Home',
  seo: { title: '', description: '' },
  sections: [
    {
      id: 'hero',
      type: 'hero',
      eyebrow: DEFAULT_HERO.eyebrow,
      lines: DEFAULT_HERO.lines,
      accent: DEFAULT_HERO.accent,
      description: DEFAULT_HERO.description,
      primaryCta: link(DEFAULT_HERO.primaryCta),
      secondaryCta: link(DEFAULT_HERO.secondaryCta),
    },
    { id: 'ticker', type: 'marquee', source: 'styles' },
    {
      id: 'intro',
      type: 'story',
      eyebrow: DEFAULT_INTRO.eyebrow,
      title: DEFAULT_INTRO.title,
      accent: DEFAULT_INTRO.accent,
      body: paragraphs(DEFAULT_INTRO.body),
      cta: link(DEFAULT_INTRO.cta),
    },
    { id: 'facts', type: 'facts' },
    {
      id: 'programs',
      type: 'programs',
      eyebrow: 'Programs',
      title: 'Find your',
      accent: 'style.',
      description:
        'From first steps to competition crews — every program has a clear path and a real stage at the end of it.',
      mode: 'featured',
      limit: 8,
    },
    {
      id: 'why',
      type: 'why',
      eyebrow: DEFAULT_WHY.eyebrow,
      title: DEFAULT_WHY.title,
      accent: DEFAULT_WHY.accent,
      surface: 'ivory',
      points: DEFAULT_WHY.points.map((p, i) => ({ id: `p${i}`, ...p })),
    },
    {
      id: 'instructors',
      type: 'instructors',
      eyebrow: 'Instructors',
      title: 'Taught by',
      accent: 'performers.',
      limit: 4,
    },
    {
      id: 'events',
      type: 'events',
      eyebrow: 'Workshops & events',
      title: 'Coming',
      accent: 'up.',
      description: 'Masterclasses, showcases and competitions — open to students and guests.',
      limit: 3,
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      eyebrow: 'In their words',
      title: 'Students &',
      accent: 'families.',
      limit: 6,
    },
    {
      id: 'gallery',
      type: 'gallery',
      eyebrow: 'Gallery',
      title: 'Moments from',
      accent: 'the floor.',
      limit: 6,
    },
    {
      id: 'studios',
      type: 'locations',
      eyebrow: 'Studios',
      title: 'Come',
      accent: 'dance with us.',
    },
    {
      id: 'cta',
      type: 'cta',
      eyebrow: DEFAULT_FINAL_CTA.eyebrow,
      title: DEFAULT_FINAL_CTA.title,
      accent: DEFAULT_FINAL_CTA.accent,
      description: DEFAULT_FINAL_CTA.description,
      primaryCta: link(DEFAULT_FINAL_CTA.primaryCta),
      secondaryCta: link(DEFAULT_FINAL_CTA.secondaryCta),
    },
  ],
})

export const ABOUT_PAGE: PageData = pageData.parse({
  title: 'About the academy',
  seo: {
    title: 'About the academy',
    description: 'The story, teaching philosophy, studios and team behind Remo Dance Company.',
  },
  sections: [
    { id: 'hero', type: 'pageHero', ...DEFAULT_ABOUT.hero },
    { id: 'facts', type: 'facts' },
    {
      id: 'story',
      type: 'story',
      ...DEFAULT_ABOUT.story,
      body: paragraphs(DEFAULT_ABOUT.story.body),
    },
    {
      id: 'philosophy',
      type: 'story',
      ...DEFAULT_ABOUT.philosophy,
      body: paragraphs(DEFAULT_ABOUT.philosophy.body),
      surface: 'ivory',
    },
    {
      id: 'team',
      type: 'instructors',
      eyebrow: 'The team',
      title: 'Taught by',
      accent: 'performers.',
      limit: 8,
    },
    {
      id: 'studios',
      type: 'locations',
      eyebrow: 'Studios',
      title: 'Come',
      accent: 'dance with us.',
    },
    {
      id: 'cta',
      type: 'cta',
      eyebrow: DEFAULT_FINAL_CTA.eyebrow,
      title: DEFAULT_FINAL_CTA.title,
      accent: DEFAULT_FINAL_CTA.accent,
      description: DEFAULT_FINAL_CTA.description,
      primaryCta: link(DEFAULT_FINAL_CTA.primaryCta),
      secondaryCta: link(DEFAULT_FINAL_CTA.secondaryCta),
    },
  ],
})

export const FAQ_SECTION = {
  id: 'faq',
  type: 'faq',
  eyebrow: 'FAQ',
  title: 'Good',
  accent: 'questions.',
  items: DEFAULT_FAQ.map((f, i) => ({ id: `q${i}`, q: f.q, a: f.a })),
}

const TEMPLATE_NOTE =
  'This is a starting template. Review it with your legal adviser and edit it in the dashboard before relying on it.'

const policy = (title: string, body: string): PageData =>
  pageData.parse({
    title,
    seo: { title, description: `${title} for Remo Dance Company.` },
    sections: [
      { id: 'hero', type: 'pageHero', eyebrow: 'Policies', lines: [title] },
      { id: 'text', type: 'text', title: '', body: `${TEMPLATE_NOTE}\n\n${body}` },
    ],
  })

export const POLICY_PAGES: Record<string, PageData> = {
  privacy: policy(
    'Privacy policy',
    [
      '## What we collect',
      'Contact details you give us (name, phone, email), details about dancers in your family, attendance and payment records, and messages you send us.',
      '## Why we use it',
      '- To run classes, bookings and fees\n- To contact you about your classes\n- To meet legal and accounting obligations',
      '## Photos and videos',
      'We only publish photos or videos of students with the consent of the student or their guardian, and you can withdraw consent at any time.',
      '## Your choices',
      'You can ask for a copy of your data, ask us to correct it, or ask us to delete it where the law allows. Contact us using the details on the contact page.',
    ].join('\n\n'),
  ),
  terms: policy(
    'Terms and conditions',
    [
      '## Enrolment',
      'A place in a batch is confirmed when enrolment is approved and the first invoice is issued.',
      '## Fees',
      'Fees are billed as shown on each program. Late fees may apply where stated on the fee plan.',
      '## Conduct and safety',
      'Students follow instructor guidance, and guardians make sure we know about any medical conditions relevant to dance.',
    ].join('\n\n'),
  ),
  'refund-policy': policy(
    'Cancellation and refund policy',
    [
      '## Trial classes',
      'Free trial classes can be rescheduled or cancelled at any time before the class.',
      '## Monthly fees',
      'Monthly fees are not refundable once the month has started. Missed classes can often be made up in another batch at the same level.',
      '## Workshops and events',
      'Refunds for workshops and events depend on how much notice you give; the amount is shown before you register.',
    ].join('\n\n'),
  ),
}
