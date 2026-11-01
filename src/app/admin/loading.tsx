import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/admin/skeletons'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <TableSkeleton />
    </div>
  )
}
