import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { listRedirects } from '@/server/services/content'
import { RedirectsTable } from './redirects-table'

export const metadata = { title: 'Redirects' }

export default function RedirectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Redirects"
        description="Send visitors and search engines from an old address to a new one. Renaming a page adds one automatically."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Redirects />
      </Suspense>
    </div>
  )
}

async function Redirects() {
  return withRequestContext(async ({ actor }) => (
    <RedirectsTable rows={await listRedirects()} canEdit={can(actor, 'cms.publish')} />
  ))
}
