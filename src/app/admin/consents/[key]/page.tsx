import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { authorize } from '@/server/rbac/authorize'
import { listTemplates } from '@/server/services/consents'
import { ConsentForm } from '../consent-form'

export const metadata = { title: 'Consent form' }

export default function ConsentPage({ params }: PageProps<'/admin/consents/[key]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Consent params={params} />
    </Suspense>
  )
}

async function Consent({ params }: Pick<PageProps<'/admin/consents/[key]'>, 'params'>) {
  const { key } = await params
  return withRequestContext(async () => {
    authorize('consents.manage')
    const t = (await listTemplates()).find((r) => r.key === key)
    if (!t) notFound()
    return (
      <div className="flex flex-col gap-6">
        <CrumbLabel segment={key} label={t.title} />
        <PageHeader title={t.title} description={`Version ${t.version}`} />
        <ConsentForm
          templateKey={t.key}
          version={t.version}
          signatures={t.signatures}
          initial={{
            type: t.type as 'custom',
            title: t.title,
            body: t.body,
            requiredFor: t.requiredFor as ['enrolment'],
            isActive: t.isActive,
          }}
        />
      </div>
    )
  })
}
