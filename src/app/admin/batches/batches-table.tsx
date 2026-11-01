'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import { StatusBadge } from '@/components/admin/status-badge'
import type { PageMeta } from '@/server/lib/result'
import type { BatchRow } from '@/server/services/batches'

const columns: ColumnDef<BatchRow, unknown>[] = [
  {
    id: 'name',
    header: 'Batch',
    enableHiding: false,
    meta: { label: 'Batch', sortKey: 'name', mobile: 'title' },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-muted-foreground font-mono text-xs">{row.original.code}</div>
      </div>
    ),
  },
  {
    id: 'program',
    header: 'Program',
    meta: { label: 'Program' },
    cell: ({ row }) => row.original.program,
  },
  {
    id: 'where',
    header: 'Where',
    meta: { label: 'Where' },
    cell: ({ row }) => (
      <span>
        {row.original.branch}
        {row.original.room && <span className="text-muted-foreground"> · {row.original.room}</span>}
      </span>
    ),
  },
  {
    id: 'schedule',
    header: 'Schedule',
    meta: { label: 'Schedule' },
    cell: ({ row }) => <span className="text-sm">{row.original.schedule}</span>,
  },
  {
    id: 'instructors',
    header: 'Instructors',
    meta: { label: 'Instructors', mobile: 'hidden' },
    cell: ({ row }) => row.original.instructors.join(', '),
  },
  {
    id: 'seats',
    header: 'Seats',
    meta: { label: 'Seats', className: 'text-right' },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.enrolled}/{row.original.capacity}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export function BatchesTable({ data, meta }: { data: BatchRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search batch name or code…"
      onRowClick={(r) => router.push(`/admin/batches/${r.id}`)}
      empty={{
        title: 'No batches here yet',
        description: 'Create a batch to put a program on the timetable.',
      }}
    />
  )
}
