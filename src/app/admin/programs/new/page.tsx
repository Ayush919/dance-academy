import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { formatMoney } from '@/lib/money'
import { withRequestContext } from '@/server/context/page'
import { authorize } from '@/server/rbac/authorize'
import { feePlanOptions } from '@/server/services/catalog'
import { instructorOptions } from '@/server/services/instructors'
import { NEW_PROGRAM, ProgramForm } from '../program-form'

export const metadata = { title: 'New program' }

export default function NewProgramPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="New program" description="Saved as a draft until you publish it." />
      <Suspense fallback={<CardsSkeleton />}>
        <Form />
      </Suspense>
    </div>
  )
}

async function Form() {
  const { instructors, plans } = await withRequestContext(async () => {
    authorize('programs.manage')
    return { instructors: await instructorOptions(), plans: await feePlanOptions() }
  })
  return (
    <ProgramForm
      id={null}
      initial={NEW_PROGRAM}
      instructors={instructors.map((i) => ({
        value: i.id,
        label: i.name,
        hint: i.specialties.slice(0, 2).join(', '),
      }))}
      feePlans={plans.map((p) => ({
        value: p.planKey,
        label: p.name,
        hint: formatMoney(p.amount),
      }))}
    />
  )
}
