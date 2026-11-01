/**
 * Default website content. These are the starting values the CMS seeds into editable content
 * documents (Phase 5); after that, the academy edits them in the dashboard and this file is only
 * the fallback for a fresh install.
 */

export interface SiteLink {
  label: string
  href: string
}

export const DEFAULT_SITE_NAV: SiteLink[] = [
  { label: 'Programs', href: '/programs' },
  { label: 'Classes', href: '/classes' },
  { label: 'Instructors', href: '/instructors' },
  { label: 'Events', href: '/events' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export const DEFAULT_FOOTER_LINKS: SiteLink[] = [
  { label: 'Book a trial class', href: '/book-trial' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'FAQ', href: '/contact#faq' },
]

export const DEFAULT_HERO = {
  eyebrow: 'Remo Dance Company · Mumbai & Pune',
  lines: ['Move like', 'the stage'],
  accent: 'is yours.',
  description:
    'Hip-hop to Bollywood, first class to first performance. Structured training from working choreographers, for every age and every level.',
  primaryCta: { label: 'Explore classes', href: '/programs' },
  secondaryCta: { label: 'Book a trial class', href: '/book-trial' },
}

export const DEFAULT_STYLES = [
  'Hip-Hop',
  'Bollywood',
  'Contemporary',
  'Jazz',
  'Freestyle',
  'Dance Fitness',
]

export const DEFAULT_INTRO = {
  eyebrow: 'The academy',
  title: 'Trained like professionals.',
  accent: 'Taught like family.',
  body: [
    'We built Remo for dancers who want more than a weekly class: a clear path from fundamentals to the stage, taught by people who perform for a living.',
    'Every batch follows a structured syllabus, every student gets feedback, and every season ends on a real stage in front of a real audience.',
  ],
  cta: { label: 'Our story', href: '/about' },
}

export const DEFAULT_FINAL_CTA = {
  eyebrow: 'Your first class is on us',
  title: 'Start',
  accent: 'this week.',
  description:
    'Book a free trial at the studio nearest you. No experience needed — just comfortable clothes and water.',
  primaryCta: { label: 'Book a trial class', href: '/book-trial' },
  secondaryCta: { label: 'See programs', href: '/programs' },
}

export const DEFAULT_WHY = {
  eyebrow: 'Why Remo',
  title: 'Built for',
  accent: 'progress.',
  points: [
    {
      title: 'Teachers who perform',
      body: 'Classes are led by working dancers and choreographers who bring stage experience into every session.',
    },
    {
      title: 'A clear path',
      body: 'Structured levels from first class to advanced crew, so every dancer knows what they are working towards.',
    },
    {
      title: 'Real stages',
      body: 'Showcases, competitions and workshops give students regular chances to perform in front of an audience.',
    },
    {
      title: 'Beginners welcome',
      body: 'Small groups and patient teaching. Nobody is expected to know the steps on day one.',
    },
    {
      title: 'Proper studios',
      body: 'Sprung floors, full-length mirrors and professional sound at every branch.',
    },
  ],
}

export const DEFAULT_ABOUT = {
  hero: {
    eyebrow: 'About the academy',
    lines: ['Where dancers', 'are made,'],
    accent: 'not just taught.',
    description:
      'Remo Dance Company trains dancers of every age across hip-hop, Bollywood, contemporary, jazz and more — in studios built for movement, with teachers who perform.',
  },
  story: {
    eyebrow: 'Our story',
    title: 'Started in a studio.',
    accent: 'Grown on stage.',
    body: [
      'Remo began with a simple belief: dance should be taught with the same care and ambition as any serious art form, and it should feel like joy every single time.',
      'Today our branches run weekly classes for children, teens and adults, from first-timers to competition crews — all following one structured syllabus and one standard of teaching.',
    ],
  },
  philosophy: {
    eyebrow: 'How we teach',
    title: 'Technique first.',
    accent: 'Expression always.',
    body: [
      'Every class balances fundamentals with choreography and freestyle. Students learn how a movement works, then how to make it their own.',
      'Progress is visible: levels have clear goals, instructors give individual feedback, and every term ends with a chance to perform.',
    ],
  },
}

export const DEFAULT_FAQ = [
  {
    q: 'I have never danced before. Is that okay?',
    a: 'Absolutely. Most of our beginner batches are made for first-timers. Book a free trial and your instructor will help you settle in.',
  },
  {
    q: 'What should I wear to class?',
    a: 'Comfortable clothes you can move in and clean indoor sneakers (or bare feet for contemporary). Bring a water bottle.',
  },
  {
    q: 'How do fees work?',
    a: 'Most programs are billed monthly in advance; some have class packs, term fees or drop-in rates. Prices are shown on each program and batch.',
  },
  {
    q: 'Can I switch batches or branches?',
    a: 'Yes, as long as there is a free seat in the batch you want. Ask at the front desk or message us on WhatsApp.',
  },
  {
    q: 'What is your cancellation and refund policy?',
    a: 'Our cancellation and refund policy is shared at enrolment and is available on request. Missed classes can often be made up in another batch at the same level.',
  },
  {
    q: 'Do you have classes for young children?',
    a: 'Yes — Little Movers is designed for ages 4 to 7, with playful rhythm and coordination work in a kids-only studio.',
  },
]
