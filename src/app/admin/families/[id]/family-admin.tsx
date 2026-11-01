'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { RELATIONSHIP_LABELS, RELATIONSHIPS } from '@/server/domain/enums'
import { addGuardianAction, setHouseholdNotesAction } from '@/server/actions/families'

/** Link a parent's existing sign-up to this family. */
export function AddGuardian({ householdId }: { householdId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState<string>('guardian')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="bg-muted/30 grid gap-4 rounded-xl border p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const res = await addGuardianAction({
          householdId,
          email,
          relationship: relationship as 'guardian',
        })
        setBusy(false)
        if (!res.ok)
          return void toast.error(
            res.error.fields ? Object.values(res.error.fields)[0]! : res.error.message,
          )
        toast.success('Parent linked to this family')
        setEmail('')
        router.refresh()
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="guardian-email">Parent’s sign-up email</Label>
        <Input
          id="guardian-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="parent@example.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="guardian-rel">Relationship</Label>
        <select
          id="guardian-rel"
          className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        >
          {RELATIONSHIPS.filter((r) => r !== 'self').map((r) => (
            <option key={r} value={r}>
              {RELATIONSHIP_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={busy || !email.includes('@')}>
        {busy && <Spinner />} Link parent
      </Button>
    </form>
  )
}

/** Notes for the studio only. Families never see these. */
export function InternalNotes({ householdId, initial }: { householdId: string; initial: string }) {
  const router = useRouter()
  const [notes, setNotes] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <div className="grid gap-2">
      <Label htmlFor="family-notes">Internal notes</Label>
      <Textarea
        id="family-notes"
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
      />
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={busy || notes === initial}
        onClick={async () => {
          setBusy(true)
          const res = await setHouseholdNotesAction({ id: householdId, notes })
          setBusy(false)
          if (!res.ok) return void toast.error(res.error.message)
          toast.success('Notes saved')
          router.refresh()
        }}
      >
        {busy && <Spinner />} Save notes
      </Button>
    </div>
  )
}
