'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import type { PageMeta } from '@/server/lib/result'
import type { HouseholdRow } from '@/server/services/families'

const columns: ColumnDef<HouseholdRow, unknown>[] = [
  {
    id: 'name',
    header: 'Family',
    enableHiding: false,
    meta: { label: 'Family', sortKey: 'name', mobile: 'title' },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-muted-foreground text-xs">
          {row.original.guardians.map((g) => g.name || g.email).join(', ') ||
            'No parent account linked'}
        </div>
      </div>
    ),
  },
  {
    id: 'students',
    header: 'Dancers',
    meta: { label: 'Dancers', className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.students}</span>,
  },
  {
    id: 'classes',
    header: 'Current classes',
    meta: { label: 'Current classes', className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.activeEnrollments}</span>,
  },
  {
    id: 'branches',
    header: 'Branches',
    meta: { label: 'Branches', mobile: 'hidden' },
    cell: ({ row }) => row.original.branches.join(', ') || '—',
  },
  {
    id: 'joined',
    header: 'Joined',
    meta: { label: 'Joined', sortKey: 'createdAt', mobile: 'hidden' },
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {new Date(row.original.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
]

export function FamiliesTable({ data, meta }: { data: HouseholdRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search family, parent or student…"
      onRowClick={(r) => router.push(`/admin/families/${r.id}`)}
      empty={{
        title: 'No families yet',
        description:
          'Families appear when parents sign up. For walk-ins, create a family here and link a parent later.',
      }}
    />
  )
}
