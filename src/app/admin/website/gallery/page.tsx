import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { listGallery } from '@/server/services/website-collections'
import { GalleryManager } from './gallery-manager'

export const metadata = { title: 'Gallery' }

export default function GalleryAdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gallery"
        description="Photos and videos on the public gallery page. Drag to reorder; hidden items stay here but don’t show on the website."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Gallery />
      </Suspense>
    </div>
  )
}

async function Gallery() {
  return withRequestContext(async ({ actor }) => (
    <GalleryManager items={await listGallery()} canEdit={can(actor, 'cms.edit')} />
  ))
}
