'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import { StatusBadge } from '@/components/admin/status-badge'
import type { PageMeta } from '@/server/lib/result'
import type { EnrollmentRow } from '@/server/services/enrolments'

const columns: ColumnDef<EnrollmentRow, unknown>[] = [
  {
    id: 'student',
    header: 'Student',
    enableHiding: false,
    meta: { label: 'Student', mobile: 'title' },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.student}</div>
        <div className="text-muted-foreground text-xs">{row.original.household}</div>
      </div>
    ),
  },
  {
    id: 'batch',
    header: 'Batch',
    meta: { label: 'Batch' },
    cell: ({ row }) => (
      <div>
        <Link
          href={`/admin/enrollments/batches/${row.original.batchId}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.program}
        </Link>
        <div className="text-muted-foreground text-xs">
          {row.original.batchCode} · {row.original.branch}
        </div>
      </div>
    ),
  },
  {
    id: 'start',
    header: 'Started',
    meta: { label: 'Started', sortKey: 'startDate', mobile: 'hidden' },
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {new Date(row.original.startDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    id: 'source',
    header: 'How',
    meta: { label: 'How', mobile: 'hidden' },
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs capitalize">{row.original.source}</span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export function EnrollmentsTable({ data, meta }: { data: EnrollmentRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search by student name…"
      onRowClick={(r) => router.push(`/admin/students/${r.studentId}`)}
      empty={{
        title: 'No enrolments yet',
        description: 'They appear when families enrol online, or when you enrol a student.',
      }}
    />
  )
}
