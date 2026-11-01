'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusBadge } from '@/components/admin/status-badge'
import { SessionActions } from '@/components/admin/sessions/session-actions'
import { EmptyState } from '@/components/states/empty-state'
import type { Option } from '@/components/forms/more-fields'
import { addDays, minutesOf, WEEKDAYS_SHORT, weekdayOf } from '@/server/domain/schedule'
import type { TimetableSession } from '@/server/services/sessions'
import { cn } from '@/lib/utils'

const HOUR_PX = 56

interface Data {
  timeZone: string
  weekStart: string
  days: string[]
  sessions: TimetableSession[]
  holidays: { date: string; name: string }[]
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

/** Greedy lane assignment so overlapping classes (different rooms) sit side by side. */
function lanes(items: TimetableSession[]) {
  const sorted = [...items].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
  const ends: number[] = []
  const out = new Map<string, { lane: number; of: number }>()
  const groups: TimetableSession[][] = []
  let group: TimetableSession[] = []
  let groupEnd = -1
  for (const s of sorted) {
    const start = minutesOf(s.startTime)
    if (start >= groupEnd && group.length) {
      groups.push(group)
      group = []
      ends.length = 0
    }
    let lane = ends.findIndex((e) => e <= start)
    if (lane === -1) lane = ends.length
    ends[lane] = minutesOf(s.endTime)
    out.set(s.id, { lane, of: 0 })
    group.push(s)
    groupEnd = Math.max(groupEnd, minutesOf(s.endTime))
  }
  if (group.length) groups.push(group)
  for (const g of groups) {
    const of = Math.max(...g.map((s) => out.get(s.id)!.lane)) + 1
    for (const s of g) out.get(s.id)!.of = of
  }
  return out
}

export function TimetableView({
  data,
  branchId,
  branches,
  rooms,
  instructors,
  filters,
  canManage,
}: {
  data: Data
  branchId: string
  branches: Option[]
  rooms: Option[]
  instructors: Option[]
  filters: { roomId?: string; instructorId?: string }
  canManage: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [selected, setSelected] = useState<TimetableSession | null>(null)

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    router.push(`${pathname}?${next.toString()}`)
  }

  const visible = data.sessions
  const first = Math.min(8 * 60, ...visible.map((s) => minutesOf(s.startTime)))
  const last = Math.max(20 * 60, ...visible.map((s) => minutesOf(s.endTime)))
  const startHour = Math.floor(first / 60)
  const endHour = Math.ceil(last / 60)
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const holidayOn = new Map(data.holidays.map((h) => [h.date, h.name]))
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: data.timeZone })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => go({ week: addDays(data.weekStart, -7) })}
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => go({ week: null })}>
            This week
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => go({ week: addDays(data.weekStart, 7) })}
          >
            <ChevronRight />
          </Button>
        </div>
        <p className="font-medium">
          {dayLabel(data.days[0]!)} – {dayLabel(data.days[6]!)}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {branches.length > 1 && (
            <Select value={branchId} onValueChange={(v) => go({ branch: v, room: null })}>
              <SelectTrigger size="sm" className="w-40" aria-label="Branch">
                <SelectValue>{branches.find((b) => b.value === branchId)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={filters.roomId ?? 'all'}
            onValueChange={(v) => go({ room: v === 'all' ? null : v })}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Room">
              <SelectValue>
                {rooms.find((r) => r.value === filters.roomId)?.label ?? 'All rooms'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rooms</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.instructorId ?? 'all'}
            onValueChange={(v) => go({ instructor: v === 'all' ? null : v })}
          >
            <SelectTrigger size="sm" className="w-44" aria-label="Instructor">
              <SelectValue>
                {instructors.find((i) => i.value === filters.instructorId)?.label ??
                  'All instructors'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All instructors</SelectItem>
              {instructors.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 && data.holidays.length === 0 ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={CalendarOff}
            title="No classes this week"
            description="Active batches appear here automatically. Try another week or clear the filters."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => go({ week: addDays(data.weekStart, 7) })}>
                  Next week <ChevronRight />
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/batches">Go to batches</Link>
                </Button>
              </div>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          {/* Desktop: hour grid */}
          <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
            <div className="grid min-w-[56rem] grid-cols-[3.5rem_repeat(7,1fr)]">
              <div className="border-b" />
              {data.days.map((d) => (
                <div
                  key={d}
                  className={cn(
                    'border-b border-l px-2 py-2 text-sm',
                    d === todayLocal && 'bg-brand/8',
                  )}
                >
                  <span className="font-medium">{WEEKDAYS_SHORT[weekdayOf(d)]}</span>{' '}
                  <span className="text-muted-foreground">{dayLabel(d)}</span>
                  {holidayOn.has(d) && (
                    <Badge variant="secondary" className="ml-1 text-[0.65rem]">
                      {holidayOn.get(d)}
                    </Badge>
                  )}
                </div>
              ))}
              <div className="relative">
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_PX }}
                    className="text-muted-foreground border-b pr-2 text-right text-[0.7rem] leading-none"
                  >
                    <span className="relative -top-1.5">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              {data.days.map((d) => {
                const daySessions = visible.filter((s) => s.date === d)
                const layout = lanes(daySessions)
                return (
                  <div
                    key={d}
                    className={cn('relative border-l', holidayOn.has(d) && 'bg-muted/50')}
                    style={{ height: hours.length * HOUR_PX }}
                  >
                    {hours.map((h) => (
                      <div key={h} style={{ height: HOUR_PX }} className="border-b border-dashed" />
                    ))}
                    {daySessions.map((s) => {
                      const top = ((minutesOf(s.startTime) - startHour * 60) / 60) * HOUR_PX
                      const height = Math.max(
                        22,
                        ((minutesOf(s.endTime) - minutesOf(s.startTime)) / 60) * HOUR_PX - 2,
                      )
                      const { lane, of } = layout.get(s.id)!
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelected(s)}
                          style={{
                            top,
                            height,
                            left: `calc(${(lane / of) * 100}% + 2px)`,
                            width: `calc(${100 / of}% - 4px)`,
                          }}
                          className={cn(
                            'absolute overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left text-xs transition-shadow hover:shadow-md focus-visible:ring-2',
                            s.status === 'cancelled'
                              ? 'border-destructive bg-destructive/8 text-muted-foreground line-through'
                              : 'border-brand bg-brand/10',
                          )}
                        >
                          <span className="block truncate font-medium">{s.batchName}</span>
                          <span className="text-muted-foreground block truncate">
                            {s.startTime}–{s.endTime} · {s.room ?? 'Online'}
                          </span>
                          {height > 50 && (
                            <span className="text-muted-foreground block truncate">
                              {s.instructor}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Phones: agenda */}
          <ol className="flex flex-col gap-4 md:hidden">
            {data.days.map((d) => {
              const daySessions = visible.filter((s) => s.date === d)
              if (!daySessions.length && !holidayOn.has(d)) return null
              return (
                <li key={d}>
                  <h3 className="mb-2 text-sm font-medium">
                    {WEEKDAYS_SHORT[weekdayOf(d)]} {dayLabel(d)}
                    {holidayOn.has(d) && (
                      <span className="text-muted-foreground"> · {holidayOn.get(d)}</span>
                    )}
                  </h3>
                  <ul className="bg-card divide-y rounded-xl border">
                    {daySessions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(s)}
                          className="flex w-full items-center gap-3 p-3 text-left"
                        >
                          <span className="w-24 text-sm tabular-nums">
                            {s.startTime}–{s.endTime}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block truncate text-sm font-medium',
                                s.status === 'cancelled' && 'line-through',
                              )}
                            >
                              {s.batchName}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {[s.room, s.instructor].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          {s.status !== 'scheduled' && <StatusBadge status={s.status} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.batchName}</SheetTitle>
                <SheetDescription>
                  {selected.program} · <span className="font-mono">{selected.batchCode}</span>
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">When</dt>
                  <dd>
                    {WEEKDAYS_SHORT[weekdayOf(selected.date)]} {dayLabel(selected.date)},{' '}
                    {selected.startTime}–{selected.endTime}
                  </dd>
                  <dt className="text-muted-foreground">Room</dt>
                  <dd>{selected.room ?? 'Online'}</dd>
                  <dt className="text-muted-foreground">Instructor</dt>
                  <dd>{selected.instructor ?? '—'}</dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selected.status} />
                    {selected.origin === 'rescheduled' && <Badge variant="outline">Moved</Badge>}
                    {selected.cancelReason && (
                      <span className="text-muted-foreground">{selected.cancelReason}</span>
                    )}
                  </dd>
                </dl>
                {canManage && (
                  <SessionActions
                    rooms={rooms}
                    instructors={instructors}
                    session={{
                      id: selected.id,
                      date: selected.date,
                      startTime: selected.startTime,
                      endTime: selected.endTime,
                      status: selected.status,
                      roomId: selected.roomId,
                      instructorId: selected.instructorId,
                      isPast: selected.isPast,
                    }}
                  />
                )}
                <Button asChild variant="link" className="w-fit px-0">
                  <Link href={`/admin/batches/${selected.batchId}`}>Open batch</Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
