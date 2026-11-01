'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DoorOpen, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { EmptyState } from '@/components/states/empty-state'
import { TextField } from '@/components/forms/fields'
import { SwitchField, TagsField } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { saveRoomAction } from '@/server/actions/academy'
import { roomInput } from '@/server/validators/academy'
import type { RoomRow } from '@/server/services/branches'

export function RoomsPanel({
  branchId,
  rooms,
  canManage,
}: {
  branchId: string
  rooms: RoomRow[]
  canManage: boolean
}) {
  const [editing, setEditing] = useState<RoomRow | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Batches are booked into rooms; a room can’t hold two classes at once or more dancers than
          its capacity.
        </p>
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <Plus /> Add room
          </Button>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={DoorOpen}
            title="No rooms yet"
            description="Add the studios at this branch so batches can be scheduled into them."
            action={
              canManage && (
                <Button onClick={() => setEditing('new')}>
                  <Plus /> Add room
                </Button>
              )
            }
            className="py-12"
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <li key={r.id} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted-foreground text-sm">
                    Up to {r.capacity} dancers{r.areaSqFt ? ` · ${r.areaSqFt} sq ft` : ''}
                  </p>
                </div>
                {!r.isActive && <Badge variant="outline">Inactive</Badge>}
              </div>
              {r.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.features.map((f) => (
                    <Badge key={f} variant="secondary" className="font-normal">
                      {f.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {r.activeBatches} running batch{r.activeBatches === 1 ? '' : 'es'}
                </span>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                    <Pencil /> Edit
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <RoomDialog
          branchId={branchId}
          room={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function RoomDialog({
  branchId,
  room,
  onClose,
}: {
  branchId: string
  room: RoomRow | null
  onClose: () => void
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: roomInput,
    defaultValues: {
      branchId,
      name: room?.name ?? '',
      capacity: room?.capacity ?? 20,
      areaSqFt: room?.areaSqFt ?? null,
      features: room?.features ?? [],
      isActive: room?.isActive ?? true,
    },
    action: (data) => saveRoomAction({ id: room?.id ?? null, data }),
    successMessage: room ? 'Room updated' : 'Room added',
    onSuccess: () => {
      onClose()
      router.refresh()
    },
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? `Edit ${room.name}` : 'Add a room'}</DialogTitle>
          <DialogDescription>
            Capacity limits how many dancers any batch here can take.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="Studio A"
              autoFocus
            />
            <FieldRow>
              <TextField
                control={form.control}
                name="capacity"
                label="Capacity"
                type="number"
                min={1}
                inputMode="numeric"
              />
              <TextField
                control={form.control}
                name="areaSqFt"
                label="Area (sq ft)"
                type="number"
                min={0}
                inputMode="numeric"
              />
            </FieldRow>
            <TagsField
              control={form.control}
              name="features"
              label="Features"
              placeholder="Mirrors, Sprung floor"
            />
            <SwitchField control={form.control} name="isActive" label="Available for classes" />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} {room ? 'Save' : 'Add room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
