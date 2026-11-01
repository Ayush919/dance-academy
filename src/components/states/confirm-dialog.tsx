'use client'

import { useState, useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

/**
 * Confirmation for destructive actions. For irreversible ones pass `confirmText` (e.g. the record's
 * name): the confirm button stays disabled until it is typed exactly.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Delete',
  confirmText,
  destructive = true,
  onConfirm,
}: {
  trigger: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel?: string
  confirmText?: string
  destructive?: boolean
  /** Return false to keep the dialog open (e.g. when the action failed). */
  onConfirm: () => Promise<boolean | void> | boolean | void
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [pending, startTransition] = useTransition()
  const blocked = confirmText !== undefined && typed !== confirmText

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) setTyped('')
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText !== undefined && (
          <div className="grid gap-2">
            <Label htmlFor="confirm-text">
              Type <span className="font-semibold">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={blocked || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm()
                if (result !== false) {
                  setOpen(false)
                  setTyped('')
                }
              })
            }
          >
            {pending && <Spinner />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
