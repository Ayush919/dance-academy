import Link from 'next/link'
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { StatusBadge } from '@/components/admin/status-badge'
import { HouseholdForm } from '@/components/families/household-form'
import { Button } from '@/components/ui/button'
import { withRequestContext } from '@/server/context/page'
import { RELATIONSHIP_LABELS, type Relationship } from '@/server/domain/enums'
import { can } from '@/server/rbac/authorize'
import { householdDetail } from '@/server/services/families'
import { AddGuardian, InternalNotes } from './family-admin'

export const metadata = { title: 'Family' }

export default function FamilyPage({ params }: PageProps<'/admin/families/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Family params={params} />
    </Suspense>
  )
}

async function Family({ params }: Pick<PageProps<'/admin/families/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const h = await householdDetail(id)
    const manage = can(actor, 'households.manage', { householdId: id })
    return (
      <div className="flex flex-col gap-12">
        <CrumbLabel segment={id} label={h.name} />
        <PageHeader
          title={h.name}
          description={`${h.students.length} dancer${h.students.length === 1 ? '' : 's'} · ${h.activeEnrollments} current class${h.activeEnrollments === 1 ? '' : 'es'}${h.branches.length ? ` · ${h.branches.join(', ')}` : ''}`}
        />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Dancers</h2>
            {can(actor, 'students.manage', { householdId: id, branchIds: [] }) && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/students/new?household=${id}`}>
                  <Plus /> Add a dancer
                </Link>
              </Button>
            )}
          </div>
          {h.students.length === 0 ? (
            <p className="text-muted-foreground text-sm">No dancers yet.</p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {h.students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3"
                  >
                    <span className="mr-auto font-medium">
                      {s.name}
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        · {s.age}
                        {s.isSelf && ' · adult'}
                      </span>
                    </span>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Parents with a login</h2>
          {h.guardians.length === 0 ? (
            <p className="text-muted-foreground text-sm">No parent account is linked yet.</p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {h.guardians.map((g) => (
                <li
                  key={g.userId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                >
                  <span className="mr-auto">
                    <span className="font-medium">{g.name || g.email}</span>
                    <span className="text-muted-foreground block text-xs">{g.email}</span>
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {RELATIONSHIP_LABELS[g.relationship as Relationship]}
                    {g.isPrimary && ' · primary'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {manage && <AddGuardian householdId={id} />}
        </section>

        {manage && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-xl font-semibold">Notes</h2>
            <InternalNotes householdId={id} initial={h.internalNotes} />
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold">Billing and contact</h2>
          {manage ? (
            <HouseholdForm
              id={id}
              initial={{ name: h.name, billing: h.billing, preferredChannel: h.preferredChannel }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Your role can’t edit these details.</p>
          )}
        </section>
      </div>
    )
  })
}
