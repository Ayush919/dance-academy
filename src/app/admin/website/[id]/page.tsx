import { Suspense } from 'react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { getDocumentForEdit } from '@/server/services/content'
import { linkSuggestions } from '@/server/services/link-suggestions'
import { EditorClient } from './editor-client'

export const metadata = { title: 'Edit' }

export default function EditDocumentPage({ params }: PageProps<'/admin/website/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({ params }: Pick<PageProps<'/admin/website/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const doc = await getDocumentForEdit(id)
    const links = await linkSuggestions()
    return (
      <div className="flex flex-col gap-4">
        <CrumbLabel segment={id} label={doc.title} />
        <PageHeader
          title={doc.title}
          description={
            doc.path
              ? `${doc.status === 'draft' ? 'Not published yet · will be at' : 'Live at'} ${doc.path}`
              : undefined
          }
        />
        <EditorClient
          doc={{ ...doc, data: doc.data as Record<string, unknown> }}
          links={links}
          canEdit={can(actor, 'cms.edit')}
          canPublish={can(actor, 'cms.publish')}
        />
      </div>
    )
  })
}
