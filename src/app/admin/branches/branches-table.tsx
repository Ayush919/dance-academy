'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import { formatPhone } from '@/lib/phone'
import type { PageMeta } from '@/server/lib/result'
import type { BranchRow } from '@/server/services/branches'

const columns: ColumnDef<BranchRow, unknown>[] = [
  {
    id: 'name',
    header: 'Branch',
    meta: { label: 'Branch', sortKey: 'name', mobile: 'title' },
    enableHiding: false,
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="font-medium">{row.original.name}</div>
        <div className="text-muted-foreground text-xs">
          {[row.original.area, row.original.city].filter(Boolean).join(', ')}
        </div>
      </div>
    ),
  },
  {
    id: 'code',
    header: 'Code',
    meta: { label: 'Code' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
  },
  {
    id: 'rooms',
    header: 'Rooms',
    meta: { label: 'Rooms', className: 'text-right' },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.rooms}
        <span className="text-muted-foreground"> · {row.original.roomCapacity} dancers</span>
      </span>
    ),
  },
  {
    id: 'phone',
    header: 'Phone',
    meta: { label: 'Phone' },
    cell: ({ row }) =>
      row.original.phone ? (
        <a
          href={`tel:${row.original.phone.replace(/\s/g, '')}`}
          className="whitespace-nowrap hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {formatPhone(row.original.phone.replace(/\s/g, ''))}
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'timezone',
    header: 'Timezone',
    meta: { label: 'Timezone', mobile: 'hidden' },
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.timezone}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge variant="secondary" className="bg-success/12 text-success">
          Open
        </Badge>
      ) : (
        <Badge variant="outline">Closed</Badge>
      ),
  },
]

export function BranchesTable({ data, meta }: { data: BranchRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      onRowClick={(r) => router.push(`/admin/branches/${r.id}`)}
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search branches…"
      empty={{
        title: 'No branches yet',
        description: 'Add your first location to start scheduling classes.',
      }}
    />
  )
}
