'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { formatMoney } from '@/lib/money'
import {
  confirmEnrolmentAction,
  enrollableBatchesAction,
  joinWaitlistAction,
  previewEnrolmentAction,
  setEnrollmentStatusAction,
  transferEnrollmentAction,
} from '@/server/actions/enrolments'
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type EnrollmentStatus,
} from '@/server/domain/enums'
import type { previewEnrolment } from '@/server/services/enrolments'
import { StudentPicker, type PickedStudent } from './student-picker'

type Preview = Awaited<ReturnType<typeof previewEnrolment>>
type BatchOption = { id: string; label: string; seatsLeft: number }

function useBatchOptions(enabled: boolean) {
  const [options, setOptions] = useState<BatchOption[] | null>(null)
  useEffect(() => {
    if (!enabled || options) return
    void enrollableBatchesAction({}).then((res) => setOptions(res.ok ? res.data : []))
  }, [enabled, options])
  return options
}

const selectClass = 'border-input h-10 w-full rounded-lg border bg-transparent px-3 text-sm'

/** Enrol a student (picked here, or fixed by the page) in an open batch, with the same checks families get. */
export function StaffEnrolDialog({
  student,
  trigger,
}: {
  student?: PickedStudent
  trigger?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<PickedStudent[]>(student ? [student] : [])
  const [batchId, setBatchId] = useState('')
  const [loaded, setLoaded] = useState<{
    key: string
    data: Preview | null
    error?: string
  } | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [overrideDocs, setOverrideDocs] = useState(false)
  const [overrideLevel, setOverrideLevel] = useState(false)
  const [busy, setBusy] = useState(false)
  const options = useBatchOptions(open)

  const studentId = picked[0]?.id ?? ''
  const key = `${studentId}:${batchId}`
  const load = useCallback(async (sid: string, bid: string) => {
    const res = await previewEnrolmentAction({ studentId: sid, batchId: bid })
    setLoaded({
      key: `${sid}:${bid}`,
      data: res.ok ? res.data : null,
      error: res.ok ? undefined : res.error.message,
    })
  }, [])

  const data = loaded?.key === key ? loaded.data : null
  const loading = !!studentId && !!batchId && loaded?.key !== key
  const chosenPlan = plan ?? (data?.feePlans.length === 1 ? data.feePlans[0]!.key : null)
  const missingDocs = (data?.missingDocuments ?? []) as DocumentType[]
  const blockedByForms = (data?.missingConsents.length ?? 0) > 0
  const blockedByProblems =
    (data?.problems.length ?? 0) > 0 &&
    !(overrideLevel && data?.levelProblem && data.problems.length === 1)
  const canEnrol =
    !!data &&
    !data.alreadyEnrolled &&
    !data.seats.full &&
    !blockedByForms &&
    !blockedByProblems &&
    (missingDocs.length === 0 || overrideDocs) &&
    (data.feePlans.length === 0 || !!chosenPlan)

  const enrol = async () => {
    setBusy(true)
    const res = await confirmEnrolmentAction({
      studentId,
      batchId,
      feePlanKey: chosenPlan,
      overrideDocuments: overrideDocs || undefined,
      overrideLevel: overrideLevel || undefined,
    })
    setBusy(false)
    if (!res.ok) return void toast.error(res.error.message)
    toast.success(`${picked[0]?.name} enrolled`)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> {trigger ?? 'Enrol a student'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enrol a student</DialogTitle>
            <DialogDescription>
              Capacity, age, forms and documents are checked exactly as they are for families.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {!student && (
              <StudentPicker
                id="enrol-student"
                label="Student"
                value={picked}
                onChange={(v) => {
                  const next = v.slice(-1)
                  setPicked(next)
                  setLoaded(null)
                  if (next[0] && batchId) void load(next[0].id, batchId)
                }}
                max={1}
              />
            )}
            <div className="grid gap-2">
              <Label htmlFor="enrol-batch">Batch</Label>
              <select
                id="enrol-batch"
                className={selectClass}
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value)
                  setPlan(null)
                  setLoaded(null)
                  if (studentId && e.target.value) void load(studentId, e.target.value)
                }}
              >
                <option value="">{options ? 'Choose a batch…' : 'Loading batches…'}</option>
                {options?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} ({o.seatsLeft} left)
                  </option>
                ))}
              </select>
            </div>

            {loading && <p className="text-muted-foreground text-sm">Checking…</p>}
            {loaded?.key === key && !data && (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t check</AlertTitle>
                <AlertDescription>{loaded.error}</AlertDescription>
              </Alert>
            )}
            {data && (
              <div className="flex flex-col gap-3">
                {data.alreadyEnrolled && (
                  <Alert>
                    <AlertTitle>Already enrolled in this batch</AlertTitle>
                  </Alert>
                )}
                {data.problems.length > 0 && !data.alreadyEnrolled && (
                  <Alert variant="destructive">
                    <AlertTitle>Can’t enrol yet</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {data.problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                      {data.levelProblem && data.mayOverride && (
                        <label className="mt-2 flex items-center gap-2">
                          <Checkbox
                            checked={overrideLevel}
                            onCheckedChange={(v) => setOverrideLevel(v === true)}
                          />
                          I’ve reviewed their level and approve this
                        </label>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {data.warnings.map((w) => (
                  <Alert key={w}>
                    <AlertTitle>Heads up</AlertTitle>
                    <AlertDescription>{w}</AlertDescription>
                  </Alert>
                ))}
                {blockedByForms && (
                  <Alert>
                    <AlertTitle>Forms still to sign</AlertTitle>
                    <AlertDescription>
                      {data.missingConsents.map((m) => m.title).join(', ')}. Open the student’s page
                      to record a paper signature, or ask the family to sign in their account.
                    </AlertDescription>
                  </Alert>
                )}
                {missingDocs.length > 0 && (
                  <Alert>
                    <AlertTitle>Documents missing</AlertTitle>
                    <AlertDescription>
                      {missingDocs.map((t) => DOCUMENT_TYPE_LABELS[t]).join(', ')}.
                      {data.mayOverride && (
                        <label className="mt-2 flex items-center gap-2">
                          <Checkbox
                            checked={overrideDocs}
                            onCheckedChange={(v) => setOverrideDocs(v === true)}
                          />
                          Enrol anyway; they’ll bring it in
                        </label>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {data.seats.full && !data.alreadyEnrolled && (
                  <Alert>
                    <AlertTitle>This batch is full</AlertTitle>
                    <AlertDescription>
                      {data.waitlist ? (
                        'They’re already on the waitlist.'
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2"
                          disabled={busy || data.problems.length > 0}
                          onClick={async () => {
                            setBusy(true)
                            const res = await joinWaitlistAction({ studentId, batchId })
                            setBusy(false)
                            if (!res.ok) return void toast.error(res.error.message)
                            toast.success(`Added to the waitlist at place ${res.data.position}`)
                            setOpen(false)
                            router.refresh()
                          }}
                        >
                          Add to waitlist
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {data.feePlans.length > 1 && (
                  <div className="grid gap-2">
                    <Label htmlFor="enrol-plan">Fee plan</Label>
                    <select
                      id="enrol-plan"
                      className={selectClass}
                      value={chosenPlan ?? ''}
                      onChange={(e) => setPlan(e.target.value)}
                    >
                      <option value="">Choose a plan…</option>
                      {data.feePlans.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name} · {formatMoney(p.amount)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canEnrol || busy} onClick={enrol}>
              {busy && <Spinner />} Enrol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Pause, resume, cancel or transfer one enrolment. Every change asks for a short note. */
export function EnrolmentActions({
  enrollmentId,
  status,
  currentBatchId,
}: {
  enrollmentId: string
  status: EnrollmentStatus
  currentBatchId: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'pause' | 'resume' | 'cancel' | 'transfer' | null>(null)
  const [note, setNote] = useState('')
  const [batchId, setBatchId] = useState('')
  const [busy, setBusy] = useState(false)
  const options = useBatchOptions(mode === 'transfer')
  if (!['active', 'paused', 'pending'].includes(status)) return null

  const close = () => {
    setMode(null)
    setNote('')
    setBatchId('')
  }
  const submit = async () => {
    setBusy(true)
    const res =
      mode === 'transfer'
        ? await transferEnrollmentAction({ enrollmentId, toBatchId: batchId, reason: note })
        : await setEnrollmentStatusAction({
            enrollmentId,
            status: mode === 'pause' ? 'paused' : mode === 'resume' ? 'active' : 'cancelled',
            note,
          })
    setBusy(false)
    if (!res.ok)
      return void toast.error(
        res.error.fields ? Object.values(res.error.fields)[0]! : res.error.message,
      )
    toast.success(mode === 'transfer' ? 'Transferred' : 'Updated')
    close()
    router.refresh()
  }
  const needsNote = mode !== 'resume'

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {status === 'paused' ? (
          <Button size="xs" variant="outline" onClick={() => setMode('resume')}>
            Resume
          </Button>
        ) : (
          <Button size="xs" variant="outline" onClick={() => setMode('pause')}>
            Pause
          </Button>
        )}
        <Button size="xs" variant="outline" onClick={() => setMode('transfer')}>
          Transfer
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className="text-destructive"
          onClick={() => setMode('cancel')}
        >
          Cancel
        </Button>
      </div>
      <Dialog open={!!mode} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'transfer'
                ? 'Transfer to another batch'
                : mode === 'cancel'
                  ? 'Cancel enrolment'
                  : mode === 'pause'
                    ? 'Pause enrolment'
                    : 'Resume enrolment'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'cancel' && 'The seat is released and offered to the waitlist.'}
              {mode === 'pause' && 'The student keeps their seat while paused.'}
              {mode === 'transfer' &&
                'Capacity, age and forms are checked for the new batch. The old seat is released.'}
              {mode === 'resume' && 'The student returns to the class.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {mode === 'transfer' && (
              <div className="grid gap-2">
                <Label htmlFor="transfer-batch">New batch</Label>
                <select
                  id="transfer-batch"
                  className={selectClass}
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                >
                  <option value="">{options ? 'Choose a batch…' : 'Loading…'}</option>
                  {options
                    ?.filter((o) => o.id !== currentBatchId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} ({o.seatsLeft} left)
                      </option>
                    ))}
                </select>
              </div>
            )}
            {needsNote && (
              <div className="grid gap-2">
                <Label htmlFor="enrol-note">{mode === 'transfer' ? 'Reason' : 'Note'}</Label>
                <Input
                  id="enrol-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={mode === 'transfer' ? 'e.g. Schedule clash with school' : 'Why?'}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Back
            </Button>
            <Button
              variant={mode === 'cancel' ? 'destructive' : 'default'}
              disabled={busy || (needsNote && !note.trim()) || (mode === 'transfer' && !batchId)}
              onClick={submit}
            >
              {busy && <Spinner />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
