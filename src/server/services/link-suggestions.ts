import 'server-only'
import { authorize } from '@/server/rbac/authorize'
import { ProgramModel } from '@/server/models/program'
import { pageOptions } from './content'

const STATIC = [
  { value: '/', label: 'Home' },
  { value: '/programs', label: 'Programs' },
  { value: '/classes', label: 'Classes' },
  { value: '/instructors', label: 'Instructors' },
  { value: '/events', label: 'Events' },
  { value: '/gallery', label: 'Gallery' },
  { value: '/contact', label: 'Contact' },
  { value: '/contact#faq', label: 'FAQ' },
  { value: '/book-trial', label: 'Book a trial' },
  { value: '/share-your-story', label: 'Share your story' },
]

/** Every internal destination an editor might link to. */
export async function linkSuggestions() {
  authorize('cms.read')
  const [pages, programs] = await Promise.all([
    pageOptions(),
    ProgramModel.find({ status: 'published', deletedAt: null }, { slug: 1, title: 1 })
      .sort({ title: 1 })
      .lean(),
  ])
  const all = [
    ...STATIC,
    ...pages,
    ...programs.map((p) => ({ value: `/programs/${p.slug}`, label: `Program: ${p.title}` })),
  ]
  return [...new Map(all.map((l) => [l.value, l])).values()]
}
