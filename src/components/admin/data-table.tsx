'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Search,
  SearchX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/states/empty-state'
import { cn } from '@/lib/utils'
import type { PageMeta } from '@/server/lib/result'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Column name for headers, the column menu and the mobile card layout. */
    label?: string
    /** Server sort key; the column is sortable only when set. */
    sortKey?: string
    /** On phones: `title` heads the card, `hidden` is omitted, default shows as a detail row. */
    mobile?: 'title' | 'hidden'
    className?: string
  }
}

const PAGE_SIZES = [10, 25, 50, 100]

/**
 * Server-driven table: search, sort and page live in the URL, the page's Server Component fetches
 * the rows. Works with the back button, can be shared as a link, and never loads more than a page.
 * On phones rows become stacked cards.
 */
export function DataTable<T>({
  columns,
  data,
  meta,
  getRowId,
  searchPlaceholder = 'Search…',
  toolbar,
  empty,
  onRowClick,
}: {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  meta: PageMeta
  getRowId: (row: T) => string
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  empty?: { title: string; description?: string; action?: React.ReactNode }
  onRowClick?: (row: T) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const urlQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  // Keep the box in step when the URL changes from elsewhere (⌘K, back button).
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setQuery(urlQuery)
  }

  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: meta.totalPages,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  })

  const navigate = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  // Debounced search; resets to the first page.
  useEffect(() => {
    if (query === urlQuery) return
    const t = setTimeout(() => navigate({ q: query || null, page: null }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const currentSort = params.get('sort') ?? ''
  const toggleSort = (key: string) => {
    const next = currentSort === key ? `-${key}` : currentSort === `-${key}` ? null : key
    navigate({ sort: next, page: null })
  }

  const rows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns()
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1
  const to = Math.min(meta.page * meta.pageSize, meta.total)
  const searching = urlQuery !== ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="hidden md:inline-flex">
                <Columns3 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide() && c.columnDef.meta?.label)
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.columnDef.meta?.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          'bg-card overflow-hidden rounded-xl border transition-opacity',
          pending && 'pointer-events-none opacity-60',
        )}
        aria-busy={pending}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={searching ? SearchX : Search}
            title={searching ? 'No matches' : (empty?.title ?? 'Nothing here yet')}
            description={
              searching
                ? 'Try a different search or clear it to see everything.'
                : empty?.description
            }
            action={
              searching ? (
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                empty?.action
              )
            }
            className="py-14"
          />
        ) : (
          <>
            {/* Desktop and tablet */}
            <Table className="hidden md:table">
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id} className="hover:bg-transparent">
                    {group.headers.map((header) => {
                      const m = header.column.columnDef.meta
                      const sortKey = m?.sortKey
                      const dir =
                        currentSort === sortKey
                          ? 'asc'
                          : currentSort === `-${sortKey}`
                            ? 'desc'
                            : null
                      return (
                        <TableHead
                          key={header.id}
                          className={cn('text-muted-foreground text-xs font-medium', m?.className)}
                          aria-sort={
                            dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined
                          }
                        >
                          {sortKey ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(sortKey)}
                              className="hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {dir === 'asc' ? (
                                <ArrowUp className="size-3.5" />
                              ) : dir === 'desc' ? (
                                <ArrowDown className="size-3.5" />
                              ) : (
                                <ChevronsUpDown className="size-3.5 opacity-40" />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Phones: stacked cards */}
            <ul className="divide-y md:hidden">
              {rows.map((row) => {
                const cells = row.getVisibleCells()
                const title = cells.find((c) => c.column.columnDef.meta?.mobile === 'title')
                return (
                  <li
                    key={row.id}
                    className={cn('flex flex-col gap-2 p-4', onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {title && (
                      <div className="font-medium">
                        {flexRender(title.column.columnDef.cell, title.getContext())}
                      </div>
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      {cells
                        .filter((c) => c !== title && c.column.columnDef.meta?.mobile !== 'hidden')
                        .map((c) => (
                          <div key={c.id} className="contents">
                            <dt className="text-muted-foreground">
                              {c.column.columnDef.meta?.label}
                            </dt>
                            <dd className="min-w-0 text-right">
                              {flexRender(c.column.columnDef.cell, c.getContext())}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <div className="text-muted-foreground flex flex-col-reverse items-center justify-between gap-3 text-sm sm:flex-row">
        <p aria-live="polite">
          {meta.total === 0 ? 'No results' : `Showing ${from}–${to} of ${meta.total}`}
          {visibleColumns.length === 0 && ' (all columns hidden)'}
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <Select
            value={String(meta.pageSize)}
            onValueChange={(v) => navigate({ pageSize: v, page: null })}
          >
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
              <SelectValue>{meta.pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={meta.page <= 1 || pending}
            onClick={() => navigate({ page: String(meta.page - 1) })}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={meta.page >= meta.totalPages || pending}
            onClick={() => navigate({ page: String(meta.page + 1) })}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
