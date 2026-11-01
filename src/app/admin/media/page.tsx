import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { authorize, can } from '@/server/rbac/authorize'
import { MediaLibrary } from './media-library'

export const metadata = { title: 'Media library' }

export default function MediaPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Media library"
        description="Every photo and video used on the website. Add alt text so everyone can understand your images."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Library />
      </Suspense>
    </div>
  )
}

async function Library() {
  const canDelete = await withRequestContext(async ({ actor }) => {
    authorize('media.read')
    return can(actor, 'media.delete')
  })
  return <MediaLibrary canDelete={canDelete} />
}
