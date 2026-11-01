'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { TriangleAlert } from 'lucide-react'
import { DataTable } from '@/components/admin/data-table'
import { StatusBadge } from '@/components/admin/status-badge'
import type { PageMeta } from '@/server/lib/result'
import type { StudentRow } from '@/server/services/families'

const columns: ColumnDef<StudentRow, unknown>[] = [
  {
    id: 'name',
    header: 'Student',
    enableHiding: false,
    meta: { label: 'Student', sortKey: 'name', mobile: 'title' },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-muted-foreground text-xs">{row.original.age} years old</div>
      </div>
    ),
  },
  {
    id: 'household',
    header: 'Family',
    meta: { label: 'Family' },
    cell: ({ row }) => row.original.household,
  },
  {
    id: 'branches',
    header: 'Branches',
    meta: { label: 'Branches', mobile: 'hidden' },
    cell: ({ row }) => row.original.branches.join(', ') || '—',
  },
  {
    id: 'classes',
    header: 'Classes',
    meta: { label: 'Classes', className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.activeClasses}</span>,
  },
  {
    id: 'flags',
    header: 'Needs attention',
    meta: { label: 'Needs attention' },
    cell: ({ row }) =>
      row.original.missingConsents > 0 ? (
        <span className="text-warning-foreground inline-flex items-center gap-1 text-xs">
          <TriangleAlert className="size-3.5" /> {row.original.missingConsents} form
          {row.original.missingConsents === 1 ? '' : 's'} unsigned
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export function StudentsTable({ data, meta }: { data: StudentRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search by student name…"
      onRowClick={(r) => router.push(`/admin/students/${r.id}`)}
      empty={{
        title: 'No students yet',
        description:
          'Students appear here when a family adds them, or when you add one from a family’s page.',
      }}
    />
  )
}
