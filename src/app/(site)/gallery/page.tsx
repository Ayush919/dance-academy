import type { Metadata } from 'next'
import { Images } from 'lucide-react'
import { GalleryGrid } from '@/components/site/gallery-grid'
import { PageHero } from '@/components/site/page-hero'
import { Container } from '@/components/site/sections/primitives'
import { EmptyState } from '@/components/states/empty-state'
import { getGallery } from '@/server/services/public'

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Performances, workshops, events and life in the studio at Remo Dance Company.',
  alternates: { canonical: '/gallery' },
}

export default async function GalleryPage() {
  const items = await getGallery()
  return (
    <>
      <PageHero eyebrow="Gallery" lines={['Moments from']} accent="the floor." />
      <main id="main-content">
        <Container className="pb-24">
          {items.length === 0 ? (
            <EmptyState
              icon={Images}
              title="Photos and videos coming soon"
              description="Shows, workshops and studio moments will appear here once the team uploads them."
              className="border-foreground/10 rounded-2xl border py-16"
            />
          ) : (
            <GalleryGrid items={items} />
          )}
        </Container>
      </main>
    </>
  )
}
