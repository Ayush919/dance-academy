'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TextField } from '@/components/forms/fields'
import {
  MultiCheckField,
  SelectField,
  SlotsField,
  SwitchField,
  type Option,
} from '@/components/forms/more-fields'
import { FieldRow, FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import {
  previewBatchConflictsAction,
  saveBatchAction,
  suggestBatchCodeAction,
} from '@/server/actions/academy'
import { BATCH_STATUSES, LEVEL_LABELS, LEVELS, type BatchStatus } from '@/server/domain/enums'
import { batchInput, type BatchInput } from '@/server/validators/academy'
import type { ConflictReport } from '@/server/services/scheduling'

export interface BatchFormOptions {
  programs: {
    id: string
    title: string
    level: string
    ageMin: number
    ageMax: number | null
    mode: string
    feePlanKeys: string[]
    instructorIds: string[]
  }[]
  branches: Option[]
  rooms: { id: string; name: string; branchId: string; capacity: number }[]
  instructors: { id: string; name: string; branchIds: string[] }[]
  feePlans: Option[]
}

const STATUS_LABELS: Record<BatchStatus, string> = {
  draft: 'Draft — not scheduled yet',
  active: 'Active — on the timetable',
  paused: 'Paused — keeps its slot, no classes',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function BatchForm({
  id,
  initial,
  options,
  readOnly,
}: {
  id: string | null
  initial: BatchInput
  options: BatchFormOptions
  readOnly?: boolean
}) {
  const router = useRouter()
  const [report, setReport] = useState<ConflictReport | null>(null)
  const [checking, setChecking] = useState(false)

  const { form, submit, pending } = useActionForm({
    schema: batchInput,
    defaultValues: initial,
    action: async (data) => {
      const res = await saveBatchAction({ id, data })
      if (!res.ok && res.error.code === 'SCHEDULE_CONFLICT') void runCheck()
      return res
    },
    successMessage: id ? 'Batch saved' : 'Batch created and classes scheduled',
    onSuccess: (res) => {
      if (!id) router.push(`/admin/batches/${res.id}`)
      router.refresh()
    },
  })
  const c = form.control
  const [programId, branchId, code] = form.watch(['programId', 'branchId', 'code'])

  // New batches inherit level, ages, fee plans and instructors from the program.
  const prevProgram = useRef(programId)
  useEffect(() => {
    if (id || !programId || programId === prevProgram.current) return
    prevProgram.current = programId
    const p = options.programs.find((x) => x.id === programId)
    if (!p) return
    form.setValue('level', p.level as BatchInput['level'])
    form.setValue('ageMin', p.ageMin)
    form.setValue('ageMax', p.ageMax)
    form.setValue('feePlanKeys', p.feePlanKeys)
    form.setValue('instructorIds', p.instructorIds)
    if (!form.getValues('name')) form.setValue('name', p.title)
  }, [id, programId, options.programs, form])

  // Suggest a code once program and branch are chosen.
  useEffect(() => {
    if (id || !programId || !branchId || code) return
    void suggestBatchCodeAction({ programId, branchId }).then(
      (r) => r.ok && form.setValue('code', r.data),
    )
  }, [id, programId, branchId, code, form])

  const rooms = useMemo<Option[]>(
    () =>
      options.rooms
        .filter((r) => r.branchId === branchId)
        .map((r) => ({ value: r.id, label: r.name, hint: `up to ${r.capacity}` })),
    [options.rooms, branchId],
  )
  const instructors = useMemo<Option[]>(
    () =>
      options.instructors.map((i) => ({
        value: i.id,
        label: i.name,
        hint: branchId && !i.branchIds.includes(branchId) ? 'other branch' : undefined,
      })),
    [options.instructors, branchId],
  )
  const online = options.programs.find((p) => p.id === programId)?.mode === 'online'

  // Live conflict check while editing (debounced; nothing is saved).
  const runCheck = async () => {
    const parsed = batchInput.safeParse(form.getValues())
    if (!parsed.success) return setReport(null)
    setChecking(true)
    const res = await previewBatchConflictsAction({ id, data: form.getValues() })
    setChecking(false)
    setReport(res.ok ? res.data : null)
  }
  const watched = form.watch([
    'schedule',
    'roomId',
    'instructorIds',
    'startDate',
    'endDate',
    'capacity',
    'status',
    'branchId',
  ])
  const key = JSON.stringify(watched)
  useEffect(() => {
    if (readOnly) return
    const t = setTimeout(() => void runCheck(), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, readOnly])

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly} className="contents">
        <FormSection title="What & where">
          <SelectField
            control={c}
            name="programId"
            label="Program"
            options={options.programs.map((p) => ({ value: p.id, label: p.title }))}
          />
          <FieldRow>
            <SelectField control={c} name="branchId" label="Branch" options={options.branches} />
            <SelectField
              control={c}
              name="roomId"
              label={online ? 'Room (optional for online)' : 'Room'}
              options={rooms}
              placeholder={branchId ? 'Select a room' : 'Choose a branch first'}
              disabled={!branchId}
            />
          </FieldRow>
          <FieldRow>
            <TextField
              control={c}
              name="name"
              label="Batch name"
              placeholder="Hip-Hop Beginners — Weekday Evenings"
            />
            <TextField
              control={c}
              name="code"
              label="Code"
              className="font-mono uppercase"
              description="Short reference used on receipts and rosters."
            />
          </FieldRow>
        </FormSection>

        <FormSection
          title="Schedule"
          description="Times are in the branch’s timezone. Classes are created ten weeks ahead and kept topped up daily."
        >
          <SlotsField
            control={c}
            name="schedule"
            label="Weekly class times"
            addLabel="Add a class time"
          />
          <FieldRow>
            <TextField control={c} name="startDate" label="Starts" type="date" />
            <TextField
              control={c}
              name="endDate"
              label="Ends (optional)"
              type="date"
              description="Leave empty for an ongoing batch."
            />
          </FieldRow>
          <ConflictPanel report={report} checking={checking} />
        </FormSection>

        <FormSection title="Dancers & teaching">
          <FieldRow>
            <SelectField
              control={c}
              name="level"
              label="Level"
              options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
            />
            <TextField control={c} name="capacity" label="Seats" type="number" min={1} />
          </FieldRow>
          <FieldRow>
            <TextField control={c} name="ageMin" label="Minimum age" type="number" min={2} />
            <TextField
              control={c}
              name="ageMax"
              label="Maximum age (optional)"
              type="number"
              min={2}
            />
          </FieldRow>
          <MultiCheckField
            control={c}
            name="instructorIds"
            label="Instructors"
            description="The first one ticked is the lead on each class."
            options={instructors}
          />
        </FormSection>

        <FormSection title="Fees & booking">
          <MultiCheckField
            control={c}
            name="feePlanKeys"
            label="Fee plans"
            options={options.feePlans}
            empty="Create fee plans first."
          />
          {online && (
            <TextField
              control={c}
              name="meetingUrl"
              label="Meeting link"
              type="url"
              placeholder="https://meet.google.com/…"
            />
          )}
          <SwitchField
            control={c}
            name="enrollmentOpen"
            label="Open for enrolment"
            description="Shown as bookable on the website when seats are free."
          />
          <SwitchField control={c} name="trialFriendly" label="Accepts trial classes" />
          <SelectField
            control={c}
            name="status"
            label="Status"
            options={BATCH_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </FormSection>
      </fieldset>

      {!readOnly && (
        <FormFooter>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || (report?.errors.length ?? 0) > 0}>
            {pending && <Spinner />} {id ? 'Save changes' : 'Create batch'}
          </Button>
        </FormFooter>
      )}
    </form>
  )
}

function ConflictPanel({ report, checking }: { report: ConflictReport | null; checking: boolean }) {
  if (checking && !report) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" aria-live="polite">
        <Spinner /> Checking rooms and instructors…
      </p>
    )
  }
  if (!report) return null
  if (report.errors.length === 0 && report.warnings.length === 0) {
    return (
      <p className="text-success flex items-center gap-2 text-sm" aria-live="polite">
        <CircleCheck className="size-4" /> No clashes with rooms, instructors or blocked time.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {report.errors.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>
            {report.totalErrors} clashing class{report.totalErrors === 1 ? '' : 'es'} to resolve
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {report.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {report.warnings.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Worth checking</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {report.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
