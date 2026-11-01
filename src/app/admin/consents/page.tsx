import Link from 'next/link'
import { Suspense } from 'react'
import { FileText } from 'lucide-react'
import { NewButton } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { EmptyState } from '@/components/states/empty-state'
import { Badge } from '@/components/ui/badge'
import { withRequestContext } from '@/server/context/page'
import {
  CONSENT_REQUIRED_LABELS,
  CONSENT_TYPE_LABELS,
  type ConsentRequiredFor,
  type ConsentType,
} from '@/server/domain/enums'
import { can } from '@/server/rbac/authorize'
import { listTemplates } from '@/server/services/consents'

export const metadata = { title: 'Consent forms' }

export default function ConsentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consent forms"
        description="Waivers, photo releases and rules families sign for each dancer. Changing the wording asks everyone to sign again."
        actions={
          <Suspense>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Forms />
      </Suspense>
    </div>
  )
}

async function Actions() {
  const ok = await withRequestContext(async ({ actor }) => can(actor, 'consents.manage'))
  return ok ? <NewButton href="/admin/consents/new" label="New form" /> : null
}

async function Forms() {
  return withRequestContext(async ({ actor }) => {
    const rows = await listTemplates()
    const manage = can(actor, 'consents.manage')
    if (rows.length === 0)
      return (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Create a liability waiver and a photo release to get started."
        />
      )
    return (
      <ul className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => {
          const card = (
            <div className="bg-card hover:bg-muted/30 flex h-full flex-col gap-3 rounded-xl border p-5 transition-colors">
              <div className="flex items-start gap-2">
                <h2 className="font-heading mr-auto font-semibold">{r.title}</h2>
                {!r.isActive && <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="text-muted-foreground text-sm">
                {CONSENT_TYPE_LABELS[r.type as ConsentType]} · version {r.version}
              </p>
              <p className="text-sm">
                {r.requiredFor.length
                  ? `Required for ${r.requiredFor.map((x) => CONSENT_REQUIRED_LABELS[x as ConsentRequiredFor].toLowerCase()).join(', ')}`
                  : 'Optional for families'}
              </p>
              <p className="text-muted-foreground mt-auto text-xs">
                {r.signatures} current signature{r.signatures === 1 ? '' : 's'}
              </p>
            </div>
          )
          return (
            <li key={r.id}>
              {manage ? <Link href={`/admin/consents/${r.key}`}>{card}</Link> : card}
            </li>
          )
        })}
      </ul>
    )
  })
}
