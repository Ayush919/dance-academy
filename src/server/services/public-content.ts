import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { draftMode } from 'next/headers'
import {
  DATA_SCHEMAS,
  type BrandData,
  type ContentKind,
  type NavigationData,
  type PageData,
  type SeoData,
} from '@/content/schema'
import { DEFAULT_BRAND, DEFAULT_NAVIGATION, DEFAULT_SEO } from '@/content/seed-content'
import { withPublicContext } from '@/server/context/public'
import { ContentDocumentModel, RedirectModel } from '@/server/models/content'
import { contentTags } from './content'

/**
 * Website content as visitors see it. Cached and tag-revalidated on publish; when an editor has
 * preview (Draft Mode) on, the cache is bypassed and the working draft is returned instead.
 */
async function read<K extends ContentKind>(kind: K, key: string) {
  'use cache'
  cacheLife('max')
  cacheTag(...contentTags(kind, key), 'content')
  const { isEnabled: preview } = await draftMode()
  return withPublicContext(async () => {
    const doc = await ContentDocumentModel.findOne(
      { kind, key, deletedAt: null },
      { draft: 1, published: 1 },
    ).lean()
    const raw = preview ? doc?.draft?.data : doc?.published?.data
    if (!raw) return null
    return { data: DATA_SCHEMAS[kind].parse(raw), preview }
  })
}

export async function getPage(key: string): Promise<{ data: PageData; preview: boolean } | null> {
  return (await read('page', key)) as { data: PageData; preview: boolean } | null
}

export async function getNavigation(): Promise<NavigationData> {
  return (
    ((await read('navigation', 'main'))?.data as NavigationData | undefined) ?? DEFAULT_NAVIGATION
  )
}

export async function getBrand(): Promise<BrandData> {
  return ((await read('brand', 'main'))?.data as BrandData | undefined) ?? DEFAULT_BRAND
}

export async function getSeo(): Promise<SeoData> {
  return ((await read('seo', 'main'))?.data as SeoData | undefined) ?? DEFAULT_SEO
}

/** Published page paths, for the sitemap and static generation. */
export async function getPublishedPageKeys(): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('content:pages')
  return withPublicContext(async () => {
    const docs = await ContentDocumentModel.find(
      { kind: 'page', deletedAt: null, 'published.data': { $ne: null } },
      { key: 1, published: 1 },
    ).lean()
    return docs
      .filter((d) => !(d.published?.data as PageData | null)?.seo?.noindex)
      .map((d) => d.key)
  })
}

export async function findRedirect(
  path: string,
): Promise<{ to: string; permanent: boolean } | null> {
  'use cache'
  cacheLife('hours')
  cacheTag('redirects')
  return withPublicContext(async () => {
    const r = await RedirectModel.findOne(
      { from: path.toLowerCase().replace(/\/+$/, '') || '/' },
      { to: 1, permanent: 1 },
    ).lean()
    return r ? { to: r.to, permanent: r.permanent } : null
  })
}
