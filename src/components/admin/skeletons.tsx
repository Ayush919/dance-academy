import { Skeleton } from '@/components/ui/skeleton'

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading">
      <Skeleton className="h-9 w-72 max-w-full" />
      <div className="bg-card space-y-2 rounded-xl border p-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

export function CardsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
