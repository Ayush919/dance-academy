'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, History, IndianRupee, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { EmptyState } from '@/components/states/empty-state'
import { TextareaField, TextField } from '@/components/forms/fields'
import { SelectField, SwitchField } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { formatMoney } from '@/lib/money'
import { saveFeePlanAction, setFeePlanArchivedAction } from '@/server/actions/academy'
import { feePlanHistoryAction } from '@/server/actions/catalog-read'
import {
  FEE_PLAN_TYPE_LABELS,
  FEE_PLAN_TYPES,
  PRORATION_LABELS,
  PRORATION_RULES,
  type FeePlanType,
} from '@/server/domain/enums'
import { feePlanInput, type FeePlanInput } from '@/server/validators/academy'
import type { FeePlanRow } from '@/server/services/catalog'

const per: Record<FeePlanType, string> = {
  monthly: '/ month',
  term: '/ term',
  course: '/ course',
  class_pack: '/ pack',
  drop_in: '/ class',
}

const todayLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export function FeePlansBoard({
  plans,
  canManage,
  showArchived,
}: {
  plans: FeePlanRow[]
  canManage: boolean
  showArchived: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<FeePlanRow | 'new' | null>(null)
  const [history, setHistory] = useState<FeePlanRow | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={showArchived ? '/admin/fee-plans' : '/admin/fee-plans?archived=1'}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {showArchived ? 'Hide archived plans' : 'Show archived plans'}
        </Link>
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <Plus /> New fee plan
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={IndianRupee}
            title="No fee plans yet"
            description="Create monthly fees, term or course prices, class packs and drop-in rates."
            action={
              canManage && (
                <Button onClick={() => setEditing('new')}>
                  <Plus /> New fee plan
                </Button>
              )
            }
            className="py-12"
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <li
              key={p.planKey}
              className={`bg-card flex flex-col gap-4 rounded-xl border p-5 ${p.archived ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {FEE_PLAN_TYPE_LABELS[p.type as FeePlanType]} · v{p.version}
                  </p>
                </div>
                {p.archived ? (
                  <Badge variant="outline">Archived</Badge>
                ) : (
                  <Badge variant="secondary">{p.usedBy} in use</Badge>
                )}
              </div>
              <p className="font-heading text-3xl font-semibold tracking-tight">
                {formatMoney(p.amount)}
                <span className="text-muted-foreground ml-1 text-sm font-normal">
                  {per[p.type as FeePlanType]}
                </span>
              </p>
              <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {p.registrationFee > 0 && (
                  <>
                    <dt>Registration</dt>
                    <dd className="text-foreground text-right">{formatMoney(p.registrationFee)}</dd>
                  </>
                )}
                {p.type === 'monthly' && (
                  <>
                    <dt>Billed on</dt>
                    <dd className="text-foreground text-right">Day {p.billingDay}</dd>
                  </>
                )}
                {p.type === 'monthly' && (
                  <>
                    <dt>Mid-month joins</dt>
                    <dd className="text-foreground text-right">
                      {PRORATION_LABELS[p.prorationRule as keyof typeof PRORATION_LABELS]}
                    </dd>
                  </>
                )}
                {p.classCount && (
                  <>
                    <dt>Classes</dt>
                    <dd className="text-foreground text-right">{p.classCount}</dd>
                  </>
                )}
                {p.validityDays && (
                  <>
                    <dt>Valid for</dt>
                    <dd className="text-foreground text-right">{p.validityDays} days</dd>
                  </>
                )}
                {p.lateFee.enabled && (
                  <>
                    <dt>Late fee</dt>
                    <dd className="text-foreground text-right">
                      {formatMoney(p.lateFee.amount)} after {p.lateFee.graceDays}d
                    </dd>
                  </>
                )}
                <dt>Sibling discount</dt>
                <dd className="text-foreground text-right">
                  {p.siblingDiscountEligible ? 'Eligible' : 'No'}
                </dd>
              </dl>
              <div className="mt-auto flex flex-wrap gap-1 border-t pt-3">
                {canManage && !p.archived && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                    <Pencil /> Change
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setHistory(p)}>
                  <History /> History
                </Button>
                {canManage && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="ml-auto">
                        {p.archived ? <ArchiveRestore /> : <Archive />}{' '}
                        {p.archived ? 'Restore' : 'Archive'}
                      </Button>
                    }
                    title={p.archived ? `Restore ${p.name}?` : `Archive ${p.name}?`}
                    description={
                      p.archived
                        ? 'It can be added to programs and batches again.'
                        : 'It can no longer be added to programs or batches. Existing enrolments are not affected.'
                    }
                    confirmLabel={p.archived ? 'Restore' : 'Archive'}
                    destructive={!p.archived}
                    onConfirm={async () => {
                      const res = await setFeePlanArchivedAction({
                        planKey: p.planKey,
                        archived: !p.archived,
                      })
                      if (!res.ok) {
                        toast.error(res.error.message)
                        return false
                      }
                      toast.success(p.archived ? 'Plan restored' : 'Plan archived')
                      router.refresh()
                    }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <FeePlanDialog plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      <HistorySheet plan={history} onClose={() => setHistory(null)} />
    </div>
  )
}

function FeePlanDialog({ plan, onClose }: { plan: FeePlanRow | null; onClose: () => void }) {
  const router = useRouter()
  const defaults: FeePlanInput = plan
    ? {
        name: plan.name,
        description: plan.description,
        type: plan.type as FeePlanType,
        amount: plan.amount / 100,
        registrationFee: plan.registrationFee / 100,
        billingDay: plan.billingDay,
        prorationRule: plan.prorationRule as FeePlanInput['prorationRule'],
        classCount: plan.classCount,
        validityDays: plan.validityDays,
        lateFeeEnabled: plan.lateFee.enabled,
        lateFeeAmount: plan.lateFee.amount / 100,
        lateFeeGraceDays: plan.lateFee.graceDays,
        siblingDiscountEligible: plan.siblingDiscountEligible,
        effectiveFrom: todayLocal(),
      }
    : {
        name: '',
        description: '',
        type: 'monthly',
        amount: '' as unknown as number,
        registrationFee: 0,
        billingDay: 1,
        prorationRule: 'daily',
        classCount: null,
        validityDays: null,
        lateFeeEnabled: false,
        lateFeeAmount: 0,
        lateFeeGraceDays: 7,
        siblingDiscountEligible: true,
        effectiveFrom: todayLocal(),
      }
  const { form, submit, pending } = useActionForm({
    schema: feePlanInput,
    defaultValues: defaults,
    action: (data) => saveFeePlanAction({ planKey: plan?.planKey ?? null, data }),
    successMessage: (r) => (plan ? `Saved as version ${r.version}` : 'Fee plan created'),
    onSuccess: () => {
      onClose()
      router.refresh()
    },
  })
  const c = form.control
  const type = form.watch('type')
  const lateFee = form.watch('lateFeeEnabled')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Change ${plan.name}` : 'New fee plan'}</DialogTitle>
          <DialogDescription>
            {plan
              ? `Saving creates version ${plan.version + 1}. Version ${plan.version} stays attached to everything already using it.`
              : 'Amounts in rupees.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField
              control={c}
              name="name"
              label="Name"
              placeholder="Monthly — 2 classes a week"
              autoFocus
            />
            <FieldRow>
              <SelectField
                control={c}
                name="type"
                label="Type"
                options={FEE_PLAN_TYPES.map((t) => ({ value: t, label: FEE_PLAN_TYPE_LABELS[t] }))}
              />
              <TextField
                control={c}
                name="amount"
                label="Price (₹)"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
              />
            </FieldRow>
            {type === 'monthly' && (
              <FieldRow>
                <TextField
                  control={c}
                  name="billingDay"
                  label="Billing day"
                  type="number"
                  min={1}
                  max={28}
                  description="Day of the month invoices are raised."
                />
                <SelectField
                  control={c}
                  name="prorationRule"
                  label="Mid-month joins"
                  options={PRORATION_RULES.map((r) => ({ value: r, label: PRORATION_LABELS[r] }))}
                />
              </FieldRow>
            )}
            {(type === 'class_pack' || type === 'term' || type === 'course') && (
              <FieldRow>
                <TextField
                  control={c}
                  name="classCount"
                  label="Number of classes"
                  type="number"
                  min={1}
                />
                <TextField
                  control={c}
                  name="validityDays"
                  label="Valid for (days)"
                  type="number"
                  min={1}
                />
              </FieldRow>
            )}
            <TextField
              control={c}
              name="registrationFee"
              label="One-time registration fee (₹)"
              type="number"
              min={0}
              inputMode="decimal"
            />
            <SwitchField
              control={c}
              name="lateFeeEnabled"
              label="Late fee"
              description="Added to the next invoice when a payment is overdue."
            />
            {lateFee && (
              <FieldRow>
                <TextField
                  control={c}
                  name="lateFeeAmount"
                  label="Late fee (₹)"
                  type="number"
                  min={0}
                />
                <TextField
                  control={c}
                  name="lateFeeGraceDays"
                  label="Grace period (days)"
                  type="number"
                  min={0}
                />
              </FieldRow>
            )}
            <SwitchField
              control={c}
              name="siblingDiscountEligible"
              label="Sibling discount applies"
            />
            <TextField control={c} name="effectiveFrom" label="Effective from" type="date" />
            <TextareaField control={c} name="description" label="Notes (optional)" rows={2} />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} {plan ? 'Save new version' : 'Create plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function HistorySheet({ plan, onClose }: { plan: FeePlanRow | null; onClose: () => void }) {
  const [versions, setVersions] = useState<FeePlanRow[] | null>(null)
  useEffect(() => {
    if (!plan) return
    let live = true
    void feePlanHistoryAction({ planKey: plan.planKey }).then((res) => {
      if (!live) return
      if (res.ok) setVersions(res.data)
      else toast.error(res.error.message)
    })
    return () => {
      live = false
      setVersions(null)
    }
  }, [plan])

  return (
    <Sheet open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{plan?.name} — history</SheetTitle>
          <SheetDescription>Every version is kept so past invoices stay accurate.</SheetDescription>
        </SheetHeader>
        <ol className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
          {!versions &&
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          {versions?.map((v) => (
            <li key={v.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Version {v.version}</span>
                <span className="font-medium tabular-nums">{formatMoney(v.amount)}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Effective{' '}
                {new Date(v.effectiveFrom).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {v.version === plan?.version ? ' · current' : ''}
              </p>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  )
}
