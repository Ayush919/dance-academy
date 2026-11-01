import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { activeBranch } from '@/server/context/workspace'
import { todayIn } from '@/server/domain/schedule'
import { authorize } from '@/server/rbac/authorize'
import { batchFormOptions } from '@/server/services/batches'
import { BatchForm } from '../batch-form'

export const metadata = { title: 'New batch' }

export default function NewBatchPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="New batch"
        description="Pick a program, a room and weekly times. Clashes are checked as you go."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Form />
      </Suspense>
    </div>
  )
}

async function Form() {
  const { options, branchId } = await withRequestContext(async () => {
    authorize('batches.manage')
    return { options: await batchFormOptions(), branchId: (await activeBranch()).branchId }
  })
  return (
    <BatchForm
      id={null}
      options={options}
      initial={{
        programId: '',
        branchId: branchId ?? options.branches[0]?.value ?? '',
        roomId: null,
        instructorIds: [],
        name: '',
        code: '',
        level: 'beginner',
        ageMin: 8,
        ageMax: null,
        capacity: 20,
        startDate: todayIn('Asia/Kolkata'),
        endDate: null,
        schedule: [
          { weekday: 1, startTime: '18:00', endTime: '19:00' },
          { weekday: 3, startTime: '18:00', endTime: '19:00' },
        ],
        feePlanKeys: [],
        meetingUrl: '',
        enrollmentOpen: true,
        trialFriendly: true,
        status: 'active',
      }}
    />
  )
}
