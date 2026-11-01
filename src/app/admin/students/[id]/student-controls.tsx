'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  LEVEL_LABELS,
  LEVELS,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUSES,
  type Level,
  type StudentStatus,
} from '@/server/domain/enums'
import { setStudentLevelsAction, setStudentStatusAction } from '@/server/actions/families'

const selectClass = 'border-input h-9 rounded-lg border bg-transparent px-3 text-sm'

/** Studio-only: the student's account status and their level in each dance style. */
export function StudentControls({
  id,
  status,
  levels,
  styles,
}: {
  id: string
  status: StudentStatus
  levels: { style: string; level: string }[]
  styles: string[]
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(status)
  const [byStyle, setByStyle] = useState<Record<string, string>>(
    Object.fromEntries(levels.map((l) => [l.style, l.level])),
  )
  const [busy, setBusy] = useState<'status' | 'levels' | null>(null)

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid content-start gap-2">
        <Label htmlFor="student-status">Status</Label>
        <select
          id="student-status"
          className={selectClass}
          value={current}
          disabled={busy === 'status'}
          onChange={async (e) => {
            const next = e.target.value as StudentStatus
            const before = current
            setCurrent(next)
            setBusy('status')
            const res = await setStudentStatusAction({ id, status: next })
            setBusy(null)
            if (!res.ok) {
              setCurrent(before)
              return void toast.error(res.error.message)
            }
            toast.success(
              next === 'suspended'
                ? 'Suspended: they can’t enrol in new classes'
                : 'Status updated',
            )
            router.refresh()
          }}
        >
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STUDENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Suspended students can’t be enrolled or offered waitlist seats.
        </p>
      </div>

      <div className="grid content-start gap-2">
        <Label>Level by style</Label>
        {styles.length === 0 ? (
          <p className="text-muted-foreground text-sm">Add programs to record levels.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {styles.map((style) => (
              <div key={style} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm">{style}</span>
                <select
                  aria-label={`${style} level`}
                  className={selectClass}
                  value={byStyle[style] ?? ''}
                  onChange={(e) => setByStyle((cur) => ({ ...cur, [style]: e.target.value }))}
                >
                  <option value="">Not assessed</option>
                  {LEVELS.filter((l) => l !== 'all').map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              disabled={busy === 'levels'}
              onClick={async () => {
                setBusy('levels')
                const res = await setStudentLevelsAction({
                  id,
                  levels: Object.entries(byStyle)
                    .filter(([, level]) => level)
                    .map(([style, level]) => ({ style, level: level as Level })),
                })
                setBusy(null)
                if (!res.ok) return void toast.error(res.error.message)
                toast.success('Levels saved')
                router.refresh()
              }}
            >
              {busy === 'levels' && <Spinner />} Save levels
            </Button>
            <p className="text-muted-foreground text-xs">
              A student can’t join a batch above their recorded level without your approval.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
