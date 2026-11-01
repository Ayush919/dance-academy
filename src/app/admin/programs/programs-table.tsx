'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Star } from 'lucide-react'
import { DataTable } from '@/components/admin/data-table'
import { StatusBadge } from '@/components/admin/status-badge'
import { LEVEL_LABELS, MODE_LABELS, type Level, type Mode } from '@/server/domain/enums'
import type { PageMeta } from '@/server/lib/result'
import type { ProgramRow } from '@/server/services/catalog'

const columns: ColumnDef<ProgramRow, unknown>[] = [
  {
    id: 'title',
    header: 'Program',
    enableHiding: false,
    meta: { label: 'Program', sortKey: 'title', mobile: 'title' },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div>
          <div className="font-medium">{row.original.title}</div>
          <div className="text-muted-foreground text-xs">/programs/{row.original.slug}</div>
        </div>
        {row.original.featured && (
          <Star className="fill-warning text-warning size-3.5" aria-label="Featured" />
        )}
      </div>
    ),
  },
  {
    id: 'style',
    header: 'Style',
    meta: { label: 'Style', sortKey: 'style' },
    cell: ({ row }) => row.original.style,
  },
  {
    id: 'level',
    header: 'Level',
    meta: { label: 'Level' },
    cell: ({ row }) => `${LEVEL_LABELS[row.original.level as Level]} · ${row.original.ages}`,
  },
  {
    id: 'mode',
    header: 'Format',
    meta: { label: 'Format', mobile: 'hidden' },
    cell: ({ row }) => MODE_LABELS[row.original.mode as Mode],
  },
  {
    id: 'batches',
    header: 'Batches',
    meta: { label: 'Batches', className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.batches}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export function ProgramsTable({ data, meta }: { data: ProgramRow[]; meta: PageMeta }) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      getRowId={(r) => r.id}
      searchPlaceholder="Search programs or styles…"
      onRowClick={(r) => router.push(`/admin/programs/${r.id}`)}
      empty={{
        title: 'No programs yet',
        description: 'Create your first program, then schedule batches for it.',
      }}
    />
  )
}
