'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Hourglass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { countdown, useNow } from '@/lib/use-now'
import {
  acceptOfferAction,
  declineOfferAction,
  leaveWaitlistAction,
} from '@/server/actions/enrolments'
import type { WaitLine } from '@/server/services/portal-data'

/** A waitlist entry: your place in line, or an offered seat to accept or decline before it expires. */
export function WaitlistCard({ line, studentName }: { line: WaitLine; studentName: string }) {
  const router = useRouter()
  const now = useNow(1000)
  const [busy, setBusy] = useState<'accept' | 'decline' | 'leave' | null>(null)
  const [plan, setPlan] = useState(line.feePlans[0]?.key ?? null)
  const offered = line.status === 'offered'

  const run = async (kind: 'accept' | 'decline' | 'leave') => {
    setBusy(kind)
    const res =
      kind === 'accept'
        ? await acceptOfferAction({ id: line.id, feePlanKey: plan })
        : kind === 'decline'
          ? await declineOfferAction({ id: line.id })
          : await leaveWaitlistAction({ id: line.id })
    setBusy(null)
    if (!res.ok) {
      if (res.error.details?.missingConsents || res.error.details?.missingDocuments)
        toast.error(res.error.message, {
          description: 'Open the dancer’s page to finish the forms.',
        })
      else toast.error(res.error.message)
      router.refresh()
      return
    }
    toast.success(
      kind === 'accept'
        ? `${studentName} is enrolled!`
        : kind === 'decline'
          ? 'Offer declined'
          : 'Removed from the waitlist',
    )
    router.refresh()
  }

  return (
    <div
      className={
        offered
          ? 'bg-brand/10 border-brand/40 rounded-xl border p-4'
          : 'bg-card rounded-xl border p-4'
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Hourglass className="text-muted-foreground size-5 shrink-0" />
        <div className="mr-auto min-w-0">
          <p className="font-medium">
            {studentName} · {line.program}
          </p>
          <p className="text-muted-foreground text-sm">
            {line.batch} · {line.schedule}
          </p>
        </div>
        {offered ? (
          <p className="text-sm font-medium">
            Seat held for {line.offerExpiresAt ? countdown(line.offerExpiresAt, now) : '—'}
          </p>
        ) : (
          <p className="text-sm font-medium">Waitlist place #{line.position}</p>
        )}
      </div>
      {offered ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {line.feePlans.length > 1 && (
            <select
              aria-label="Fee plan"
              className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
              value={plan ?? ''}
              onChange={(e) => setPlan(e.target.value)}
            >
              {line.feePlans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => run('accept')} disabled={busy !== null}>
            {busy === 'accept' && <Spinner />} Accept seat
          </Button>
          <Button variant="outline" onClick={() => run('decline')} disabled={busy !== null}>
            {busy === 'decline' && <Spinner />} No thanks
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground text-xs">
            We’ll email you as soon as a seat opens up.
          </p>
          <Button size="xs" variant="ghost" onClick={() => run('leave')} disabled={busy !== null}>
            {busy === 'leave' && <Spinner />} Leave waitlist
          </Button>
        </div>
      )}
      {offered && (
        <p className="text-muted-foreground mt-3 text-xs">
          Need to sign a form first? Open the dancer’s page, sign it, then come back and accept.
        </p>
      )}
    </div>
  )
}
