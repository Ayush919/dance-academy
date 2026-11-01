'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleCheck, FileText, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { MEDIA_SCOPE_LABELS, MEDIA_SCOPES, type MediaScope } from '@/server/domain/enums'
import { revokeConsentAction, signConsentAction } from '@/server/actions/consents'
import type { StudentConsentRow } from '@/server/services/consents'
import { ConsentBody } from './consent-body'

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Read the form, type your name, tick the box. For a media release, choose where it applies. */
export function ConsentSigner({
  studentId,
  row,
  defaultName = '',
  onDone,
  onBehalf = false,
}: {
  studentId: string
  row: Pick<StudentConsentRow, 'templateId' | 'title' | 'body' | 'type' | 'version'>
  defaultName?: string
  onDone: () => void
  onBehalf?: boolean
}) {
  const [name, setName] = useState(defaultName)
  const [agree, setAgree] = useState(false)
  const [scopes, setScopes] = useState<MediaScope[]>(['website'])
  const [pending, setPending] = useState(false)
  const media = row.type === 'media_release'
  const idBase = `sign-${row.templateId}`

  const submit = async () => {
    setPending(true)
    const res = await signConsentAction({
      studentId,
      templateId: row.templateId,
      typedName: name,
      agree,
      scopes: media ? scopes : [],
    })
    setPending(false)
    if (!res.ok)
      return void toast.error(
        res.error.fields ? Object.values(res.error.fields)[0]! : res.error.message,
      )
    toast.success(`${row.title} signed`)
    onDone()
  }

  return (
    <div className="bg-muted/30 flex flex-col gap-4 rounded-xl border p-4">
      <div className="bg-background max-h-64 overflow-y-auto rounded-lg border p-4">
        <ConsentBody body={row.body} />
      </div>
      {media && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            The studio may use photos and video of the dancer on…
          </legend>
          {MEDIA_SCOPES.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <Checkbox
                id={`${idBase}-${s}`}
                checked={scopes.includes(s)}
                onCheckedChange={(v) =>
                  setScopes((cur) => (v === true ? [...cur, s] : cur.filter((x) => x !== s)))
                }
              />
              <Label htmlFor={`${idBase}-${s}`} className="font-normal">
                {MEDIA_SCOPE_LABELS[s]}
              </Label>
            </div>
          ))}
          <p className="text-muted-foreground text-xs">
            Choose none to say no. You can change this any time.
          </p>
        </fieldset>
      )}
      <div className="grid gap-2 sm:max-w-sm">
        <Label htmlFor={`${idBase}-name`}>
          {onBehalf ? 'Parent’s full name, as signed on paper' : 'Your full name'}
        </Label>
        <Input
          id={`${idBase}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id={`${idBase}-agree`}
          checked={agree}
          onCheckedChange={(v) => setAgree(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor={`${idBase}-agree`} className="leading-snug font-normal">
          {onBehalf
            ? 'I have the signed paper form and am recording it on the family’s behalf.'
            : 'I have read and agree to this form, and I’m signing it as the parent or guardian (or as myself if I’m an adult).'}
        </Label>
      </div>
      <Button
        className="w-fit"
        disabled={pending || !agree || name.trim().length < 2}
        onClick={submit}
      >
        {pending && <Spinner />} Sign form
      </Button>
    </div>
  )
}

/** All forms for one student: what's signed, what needs signing, and withdrawing consent. */
export function ConsentPanel({
  studentId,
  rows,
  canSign,
  signerName,
  staff = false,
}: {
  studentId: string
  rows: StudentConsentRow[]
  canSign: boolean
  signerName?: string
  staff?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const refresh = () => {
    setOpen(null)
    router.refresh()
  }

  if (!rows.length)
    return (
      <p className="text-muted-foreground text-sm">The studio hasn’t published any forms yet.</p>
    )

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const needs = r.state !== 'signed'
        return (
          <li key={r.templateId} className="bg-card rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <FileText className="text-muted-foreground size-5 shrink-0" />
              <div className="mr-auto min-w-0">
                <p className="font-medium">{r.title}</p>
                <p className="text-muted-foreground text-xs">
                  Version {r.version}
                  {r.requiredFor.includes('enrolment') && ' · required to enrol'}
                </p>
              </div>
              {r.state === 'signed' && (
                <Badge variant="secondary" className="bg-success/12 text-success gap-1">
                  <CircleCheck className="size-3" /> Signed
                </Badge>
              )}
              {r.state === 'unsigned' && <Badge variant="outline">Not signed</Badge>}
              {r.state === 'outdated' && (
                <Badge variant="secondary" className="bg-warning/15 gap-1">
                  <TriangleAlert className="size-3" /> Updated — sign again
                </Badge>
              )}
              {r.state === 'revoked' && <Badge variant="outline">Withdrawn</Badge>}
              {canSign && needs && (
                <Button
                  size="sm"
                  variant={open === r.templateId ? 'ghost' : 'default'}
                  onClick={() => setOpen(open === r.templateId ? null : r.templateId)}
                >
                  {open === r.templateId ? 'Close' : 'Read and sign'}
                </Button>
              )}
            </div>
            {r.record && (
              <p className="text-muted-foreground mt-2 text-xs">
                {r.state === 'signed' && (
                  <>
                    Signed by {r.record.typedName} on {fmt(r.record.signedAt)}
                    {r.record.onBehalf && ' (recorded by the studio from a paper form)'}
                    {r.type === 'media_release' &&
                      ` · ${r.record.scopes.length ? r.record.scopes.map((s) => MEDIA_SCOPE_LABELS[s as MediaScope]).join(', ') : 'no channels allowed'}`}
                  </>
                )}
                {r.state === 'outdated' && (
                  <>
                    Last signed on {fmt(r.record.signedAt)} (version {r.record.version}). The
                    wording has changed.
                  </>
                )}
                {r.state === 'revoked' && r.record.revokedAt && (
                  <>
                    Withdrawn on {fmt(r.record.revokedAt)}
                    {r.record.revokedReason ? ` — ${r.record.revokedReason}` : ''}.
                  </>
                )}
              </p>
            )}
            {r.state === 'signed' && r.record && (canSign || staff) && (
              <RevokeButton
                recordId={r.record.id}
                title={r.title}
                media={r.type === 'media_release'}
                onDone={refresh}
              />
            )}
            {open === r.templateId && canSign && (
              <div className="mt-4">
                <ConsentSigner
                  studentId={studentId}
                  row={r}
                  defaultName={staff ? '' : signerName}
                  onBehalf={staff}
                  onDone={refresh}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function RevokeButton({
  recordId,
  title,
  media,
  onDone,
}: {
  recordId: string
  title: string
  media: boolean
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="mt-2">
      <ConfirmDialog
        trigger={
          <Button size="xs" variant="ghost" className="text-muted-foreground">
            Withdraw consent
          </Button>
        }
        title={`Withdraw “${title}”?`}
        description={
          <div className="flex flex-col gap-3">
            <p>
              The signature stays on record, marked as withdrawn.
              {media &&
                ' Any photos, videos or reviews on the website that show this dancer come down straight away.'}
            </p>
            <Input
              aria-label="Reason (optional)"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        }
        confirmLabel="Withdraw"
        onConfirm={async () => {
          const res = await revokeConsentAction({ id: recordId, reason })
          if (!res.ok) {
            toast.error(res.error.message)
            return false
          }
          const n = res.data.galleryUnpublished + res.data.testimonialsUnpublished
          toast.success(
            n
              ? `Withdrawn. ${n} item${n === 1 ? '' : 's'} taken off the website.`
              : 'Consent withdrawn',
          )
          onDone()
        }}
      />
    </div>
  )
}
