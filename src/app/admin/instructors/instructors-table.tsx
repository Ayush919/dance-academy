'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import type { PageMeta } from '@/server/lib/result'
import type { InstructorRow } from '@/server/services/instructors'

const columns: ColumnDef<InstructorRow, unknown>[] = [
  {
    id: 'name',
    header: 'Instructor',
    enableHiding: false,
    meta: { label: 'Instructor', sortKey: 'name', mobile: 'title' },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-muted-foreground text-xs">
          {row.original.title || row.original.specialties.slice(0, 3).join(', ')}
        </div>
      </div>
    ),
  },
  {
    id: 'branches',
    header: 'Branches',
    meta: { label: 'Branches' },
    cell: ({ row }) => row.original.branches.join(', ') || '—',
  },
  {
    id: 'availability',
    header: 'Available',
    meta: { label: 'Available', mobile: 'hidden' },
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{row.original.availability}</span>
    ),
  },
  {
    id: 'batches',
    header: 'Batches',
    meta: { label: 'Batches', className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.activeBatches}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {!row.original.isActive && <Badge variant="outline">Inactive</Badge>}
        {row.original.isActive && !row.original.isPublic && (
          <Badge variant="secondary">Hidden from site</Badge>
        )}
        {row.original.isActive && row.original.isPublic && (
          <Badge variant="secondary" className="bg-success/12 text-success">
            On website
          </Badge>
        )}
      </div>
    ),
  },
]

export function InstructorsTable({ data, meta }: { data: InstructorRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search name or style…"
      onRowClick={(r) => router.push(`/admin/instructors/${r.id}`)}
      empty={{
        title: 'No instructors yet',
        description: 'Add your teaching team to assign them to programs and batches.',
      }}
    />
  )
}
