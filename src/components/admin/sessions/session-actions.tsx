'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { TextField } from '@/components/forms/fields'
import { SelectField, type Option } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import {
  cancelSessionAction,
  rescheduleSessionAction,
  restoreSessionAction,
} from '@/server/actions/academy'
import { sessionRescheduleInput } from '@/server/validators/academy'

export interface SessionSummary {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  roomId?: string | null
  instructorId?: string | null
  isPast: boolean
}

/** Move, cancel or restore one class. Used on the batch page and the timetable. */
export function SessionActions({
  session,
  rooms,
  instructors,
  compact,
}: {
  session: SessionSummary
  rooms: Option[]
  instructors: Option[]
  compact?: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<'move' | 'cancel' | null>(null)
  if (session.isPast) return null
  const size = compact ? 'xs' : 'sm'

  return (
    <div className="flex flex-wrap gap-1">
      {session.status === 'scheduled' && (
        <>
          <Button size={size} variant="outline" onClick={() => setDialog('move')}>
            Move
          </Button>
          <Button size={size} variant="ghost" onClick={() => setDialog('cancel')}>
            Cancel class
          </Button>
        </>
      )}
      {session.status === 'cancelled' && (
        <ConfirmDialog
          trigger={
            <Button size={size} variant="outline">
              Restore
            </Button>
          }
          title="Restore this class?"
          description="It goes back on the timetable if the room and instructor are still free."
          confirmLabel="Restore"
          destructive={false}
          onConfirm={async () => {
            const res = await restoreSessionAction({ id: session.id })
            if (!res.ok) {
              toast.error(res.error.message)
              return false
            }
            toast.success('Class restored')
            router.refresh()
          }}
        />
      )}
      {dialog === 'move' && (
        <MoveDialog
          session={session}
          rooms={rooms}
          instructors={instructors}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'cancel' && (
        <CancelDialog sessionId={session.id} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}

function MoveDialog({
  session,
  rooms,
  instructors,
  onClose,
}: {
  session: SessionSummary
  rooms: Option[]
  instructors: Option[]
  onClose: () => void
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: sessionRescheduleInput,
    defaultValues: {
      sessionId: session.id,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      roomId: session.roomId ?? null,
      instructorId: session.instructorId ?? null,
      note: '',
    },
    action: (data) => rescheduleSessionAction(data),
    successMessage: 'Class moved',
    onSuccess: () => {
      onClose()
      router.refresh()
    },
  })
  const c = form.control
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move this class</DialogTitle>
          <DialogDescription>
            Only this class changes; the batch schedule stays the same. Times are branch-local.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField control={c} name="date" label="Date" type="date" />
            <FieldRow>
              <TextField control={c} name="startTime" label="Starts" type="time" />
              <TextField control={c} name="endTime" label="Ends" type="time" />
            </FieldRow>
            <FieldRow>
              <SelectField control={c} name="roomId" label="Room" options={rooms} />
              <SelectField
                control={c}
                name="instructorId"
                label="Instructor"
                options={instructors}
              />
            </FieldRow>
            <TextField
              control={c}
              name="note"
              label="Note (optional)"
              placeholder="Moved for the showcase rehearsal"
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} Move class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const cancelForm = z.object({
  reason: z.string().trim().min(1, 'Give a reason families will see').max(200),
})

function CancelDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: cancelForm,
    defaultValues: { reason: '' },
    action: ({ reason }) => cancelSessionAction({ sessionId, reason }),
    successMessage: 'Class cancelled',
    onSuccess: () => {
      onClose()
      router.refresh()
    },
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this class?</DialogTitle>
          <DialogDescription>
            Enrolled families will be told the reason once notifications are switched on.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <TextField
            control={form.control}
            name="reason"
            label="Reason"
            placeholder="Instructor unwell"
            autoFocus
          />
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Keep class
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Spinner />} Cancel class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
