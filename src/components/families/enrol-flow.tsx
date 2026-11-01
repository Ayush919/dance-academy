'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { WaitlistCard } from '@/components/families/offer-card'
import { ConsentSigner } from '@/components/families/consent-panel'
import { formatMoney } from '@/lib/money'
import { countdown, useNow } from '@/lib/use-now'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/server/domain/enums'
import {
  confirmEnrolmentAction,
  joinWaitlistAction,
  previewEnrolmentAction,
  releaseHoldAction,
  startEnrolmentAction,
} from '@/server/actions/enrolments'
import { studentConsents } from '@/server/services/consents'
import type { previewEnrolment } from '@/server/services/enrolments'

type Preview = Awaited<ReturnType<typeof previewEnrolment>>
type ConsentRows = Awaited<ReturnType<typeof studentConsents>>

/**
 * The family's enrolment checklist for one batch: eligibility, forms to sign, documents, fee plan,
 * a 15-minute seat hold while they finish, and a final confirm (which re-checks everything).
 */
export function EnrolFlow({
  batchId,
  students,
  initialStudentId,
  signerName,
  consentRows,
  initialPreview,
}: {
  batchId: string
  students: { id: string; name: string }[]
  initialStudentId: string
  signerName: string
  /** Full text of every active form, so each unsigned one can be read and signed right here. */
  consentRows: ConsentRows
  /** Loaded on the server for the first dancer, so the page opens with the answer already there. */
  initialPreview: Preview
}) {
  const router = useRouter()
  const now = useNow(1000)
  const [studentId, setStudentId] = useState(initialStudentId)
  const [loaded, setLoaded] = useState<{
    key: string
    data: Preview | null
    error?: string
  } | null>({ key: initialStudentId, data: initialPreview })
  const [plan, setPlan] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [signing, setSigning] = useState<string | null>(null)

  const load = useCallback(
    async (sid: string) => {
      const res = await previewEnrolmentAction({ studentId: sid, batchId })
      setLoaded({
        key: sid,
        data: res.ok ? res.data : null,
        error: res.ok ? undefined : res.error.message,
      })
    },
    [batchId],
  )

  const data = loaded?.key === studentId ? loaded.data : null
  const loading = loaded?.key !== studentId
  const student = students.find((s) => s.id === studentId)
  const chosenPlan = plan ?? (data?.feePlans.length === 1 ? data.feePlans[0]!.key : null)

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    await fn()
    setBusy(null)
  }

  if (done)
    return (
      <div className="bg-card flex flex-col items-start gap-4 rounded-2xl border p-8" role="status">
        <CircleCheck className="text-success size-10" />
        <h2 className="font-heading text-2xl font-semibold">{student?.name} is enrolled!</h2>
        <p className="text-muted-foreground max-w-md">
          You’ll find the class on your family page. The studio will be in touch about fees and what
          to bring on the first day.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/portal">Go to my family page</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/classes">Browse more classes</Link>
          </Button>
        </div>
      </div>
    )

  const holdLeft = data?.hold ? new Date(data.hold.expiresAt).getTime() - now : 0
  const holdActive = !!data?.hold && (now === 0 || holdLeft > 0)
  const consentsMissing = data?.missingConsents ?? []
  const docsMissing = (data?.missingDocuments ?? []) as DocumentType[]
  const outstanding = consentsMissing.length + docsMissing.length

  return (
    <div className="flex flex-col gap-6">
      {students.length > 1 && (
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="enrol-student">Who is this for?</Label>
          <select
            id="enrol-student"
            className="border-input h-10 rounded-lg border bg-transparent px-3 text-sm"
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value)
              setPlan(null)
              void load(e.target.value)
            }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Checking availability…</p>}
      {!loading && !data && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>We couldn’t load this class</AlertTitle>
          <AlertDescription>{loaded?.error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          <div className="bg-card rounded-2xl border p-5">
            <p className="type-eyebrow text-brand">{data.batch.program}</p>
            <h2 className="font-heading mt-1 text-xl font-semibold">{data.batch.name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {data.batch.schedule} · {data.batch.branch}
            </p>
            <p className="text-muted-foreground text-sm">
              Starts{' '}
              {new Date(data.batch.startDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              · Ages {data.batch.ageMin}
              {data.batch.ageMax ? `–${data.batch.ageMax}` : '+'}
            </p>
          </div>

          {data.warnings.map((w) => (
            <Alert key={w}>
              <TriangleAlert />
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}

          {data.alreadyEnrolled ? (
            <Alert>
              <CircleCheck />
              <AlertTitle>{student?.name} is already in this class</AlertTitle>
              <AlertDescription>
                <Link href="/portal" className="underline">
                  Back to my family page
                </Link>
              </AlertDescription>
            </Alert>
          ) : data.problems.length > 0 ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>{student?.name} can’t join this class yet</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {data.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : data.waitlist ? (
            <WaitlistCard
              line={{
                id: data.waitlist.id,
                batchId,
                batch: data.batch.name,
                program: data.batch.program,
                schedule: data.batch.schedule,
                status: data.waitlist.status as 'waiting' | 'offered',
                position: data.waitlist.position,
                offerExpiresAt: data.waitlist.offerExpiresAt,
                feePlans: data.feePlans.map((p) => ({ key: p.key, name: p.name })),
              }}
              studentName={student?.name ?? ''}
            />
          ) : data.seats.full ? (
            <div className="bg-card flex flex-col items-start gap-3 rounded-2xl border p-5">
              <h3 className="font-heading text-lg font-semibold">This class is full</h3>
              <p className="text-muted-foreground text-sm">
                Join the waitlist and we’ll email you the moment a seat opens. You’ll have 24 hours
                to accept it.
                {data.seats.waiting > 0 &&
                  ` ${data.seats.waiting} ${data.seats.waiting === 1 ? 'family is' : 'families are'} already waiting.`}
              </p>
              <Button
                disabled={busy !== null}
                onClick={() =>
                  act('wait', async () => {
                    const res = await joinWaitlistAction({ studentId, batchId })
                    if (!res.ok) toast.error(res.error.message)
                    else toast.success(`You’re number ${res.data.position} on the waitlist`)
                    await load(studentId)
                    router.refresh()
                  })
                }
              >
                {busy === 'wait' && <Spinner />} Join the waitlist
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h3 className="font-heading text-lg font-semibold">1. Forms to sign</h3>
                {consentsMissing.length === 0 ? (
                  <p className="text-success flex items-center gap-2 text-sm">
                    <CircleCheck className="size-4" /> All required forms are signed.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {consentsMissing.map((m) => {
                      const full = consentRows.find((r) => r.templateId === m.templateId)
                      return (
                        <li key={m.templateId} className="bg-card rounded-xl border p-4">
                          <div className="flex items-center gap-3">
                            <p className="mr-auto font-medium">{m.title}</p>
                            <Button
                              size="sm"
                              variant={signing === m.templateId ? 'ghost' : 'default'}
                              onClick={() =>
                                setSigning(signing === m.templateId ? null : m.templateId)
                              }
                            >
                              {signing === m.templateId ? 'Close' : 'Read and sign'}
                            </Button>
                          </div>
                          {signing === m.templateId && full && (
                            <div className="mt-4">
                              <ConsentSigner
                                studentId={studentId}
                                row={full}
                                defaultName={signerName}
                                onDone={() => {
                                  setSigning(null)
                                  void load(studentId)
                                }}
                              />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {docsMissing.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="font-heading text-lg font-semibold">2. Documents</h3>
                  <p className="text-sm">
                    This program needs:{' '}
                    <strong>{docsMissing.map((t) => DOCUMENT_TYPE_LABELS[t]).join(', ')}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/portal/students/${studentId}#documents`} target="_blank">
                        Upload on {student?.name.split(' ')[0]}’s page
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void load(studentId)}>
                      I’ve uploaded them — check again
                    </Button>
                  </div>
                </section>
              )}

              {data.feePlans.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="font-heading text-lg font-semibold">
                    {docsMissing.length > 0 ? '3' : '2'}. Fee plan
                  </h3>
                  <div
                    className="grid gap-2 sm:grid-cols-2"
                    role="radiogroup"
                    aria-label="Fee plan"
                  >
                    {data.feePlans.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={chosenPlan === p.key}
                        onClick={() => setPlan(p.key)}
                        className={`rounded-xl border p-4 text-left transition-colors ${chosenPlan === p.key ? 'border-brand bg-brand/10' : 'hover:bg-muted'}`}
                      >
                        <span className="block font-medium">{p.name}</span>
                        <span className="text-muted-foreground block text-sm">
                          {formatMoney(p.amount)}
                        </span>
                        {p.description && (
                          <span className="text-muted-foreground block text-xs">
                            {p.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="bg-card flex flex-col gap-3 rounded-2xl border p-5">
                {outstanding > 0 && !holdActive && (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-muted-foreground text-sm">
                      Need a few minutes? Hold your seat while you finish.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        act('hold', async () => {
                          const res = await startEnrolmentAction({ studentId, batchId })
                          if (!res.ok) toast.error(res.error.message)
                          await load(studentId)
                        })
                      }
                    >
                      {busy === 'hold' && <Spinner />} Hold my seat for 15 minutes
                    </Button>
                  </div>
                )}
                {holdActive && data.hold && (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="size-4" /> Seat held for{' '}
                      {countdown(data.hold.expiresAt, now)}
                    </p>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() =>
                        act('release', async () => {
                          await releaseHoldAction({ studentId, batchId })
                          await load(studentId)
                        })
                      }
                    >
                      Release it
                    </Button>
                  </div>
                )}
                {data.hold && !holdActive && (
                  <p className="text-warning-foreground text-sm">
                    Your hold has run out. If a seat is still free you can still enrol below.
                  </p>
                )}
                <Button
                  size="lg"
                  className="w-fit"
                  disabled={
                    busy !== null || outstanding > 0 || (data.feePlans.length > 0 && !chosenPlan)
                  }
                  onClick={() =>
                    act('confirm', async () => {
                      const res = await confirmEnrolmentAction({
                        studentId,
                        batchId,
                        feePlanKey: chosenPlan,
                      })
                      if (res.ok) {
                        setDone(true)
                        router.refresh()
                        return
                      }
                      toast.error(res.error.message)
                      await load(studentId)
                    })
                  }
                >
                  {busy === 'confirm' && <Spinner />} Confirm enrolment
                </Button>
                {outstanding > 0 && (
                  <p className="text-muted-foreground text-xs">
                    Finish the steps above to enable this button.
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
