'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Globe,
  MessageSquareQuote,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react'
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
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { EmptyState } from '@/components/states/empty-state'
import { TextareaField, TextField } from '@/components/forms/fields'
import { SelectField, SwitchField } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { StudentPicker, type PickedStudent } from '@/components/families/student-picker'
import { cn } from '@/lib/utils'
import {
  deleteTestimonialAction,
  reorderTestimonialsAction,
  saveTestimonialAction,
  setTestimonialFeaturedAction,
  setTestimonialStatusAction,
} from '@/server/actions/website'
import type { TestimonialRow, TestimonialStatus } from '@/server/services/website-collections'
import {
  TESTIMONIAL_RELATION_LABELS,
  TESTIMONIAL_RELATIONS,
  testimonialInput,
} from '@/server/validators/website'

const EMPTY: Record<TestimonialStatus, string> = {
  pending: 'No reviews waiting. New ones from the “Share your story” page land here.',
  approved: 'No reviews on the website yet. Approve one, or add a review you collected in person.',
  rejected: 'Nothing rejected.',
}

export function TestimonialsBoard({
  rows: initial,
  status,
}: {
  rows: TestimonialRow[]
  status: TestimonialStatus
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editing, setEditing] = useState<TestimonialRow | 'new' | null>(null)
  // Take fresh server data after router.refresh(), replacing optimistic local changes.
  const [synced, setSynced] = useState(initial)
  if (synced !== initial) {
    setSynced(initial)
    setRows(initial)
  }

  const run = async (
    work: Promise<{ ok: boolean; error?: { message: string } }>,
    message?: string,
  ) => {
    const res = await work
    if (!res.ok) toast.error(res.error?.message ?? 'Something went wrong')
    else if (message) toast.success(message)
    router.refresh()
    return res.ok
  }

  const move = async (from: number, to: number) => {
    const next = [...rows]
    const [r] = next.splice(from, 1)
    next.splice(to, 0, r!)
    setRows(next)
    await run(reorderTestimonialsAction({ ids: next.map((t) => t.id) }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus /> Add a review
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={MessageSquareQuote} title="Nothing here" description={EMPTY[status]} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((t, i) => (
            <li
              key={t.id}
              className={cn(
                'bg-card flex flex-col gap-3 rounded-xl border p-4',
                t.featured && 'border-brand/50',
              )}
            >
              <blockquote className="text-sm leading-relaxed whitespace-pre-line">
                “{t.quote}”
              </blockquote>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="mr-auto min-w-0">
                  <p className="text-sm font-medium">
                    {t.authorName}
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      · {TESTIMONIAL_RELATION_LABELS[t.relation]}
                      {t.programTitle && ` · ${t.programTitle}`}
                    </span>
                  </p>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    {t.rating && (
                      <span aria-label={`${t.rating} out of 5`}>
                        {'★'.repeat(t.rating)}
                        {'☆'.repeat(5 - t.rating)}
                      </span>
                    )}
                    {t.source === 'website' && (
                      <Badge variant="outline" className="gap-1 font-normal">
                        <Globe className="size-3" /> Sent from website
                      </Badge>
                    )}
                    {t.featured && (
                      <Badge className="bg-brand text-brand-foreground">Featured</Badge>
                    )}
                    {t.contact && status === 'pending' && <span>Contact: {t.contact}</span>}
                    <span>
                      {new Date(t.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {status === 'approved' && (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Move down"
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, i + 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t.featured ? 'Stop featuring' : 'Feature'}
                        aria-pressed={t.featured}
                        onClick={() =>
                          run(setTestimonialFeaturedAction({ id: t.id, featured: !t.featured }))
                        }
                      >
                        <Star className={cn(t.featured && 'fill-brand text-brand')} />
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => setEditing(t)}
                  >
                    <Pencil />
                  </Button>
                  {status !== 'approved' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          setTestimonialStatusAction({ id: t.id, status: 'approved' }),
                          'Approved — it’s on the website',
                        )
                      }
                    >
                      <Check /> Approve
                    </Button>
                  )}
                  {status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          setTestimonialStatusAction({ id: t.id, status: 'rejected' }),
                          'Rejected',
                        )
                      }
                    >
                      <X /> Reject
                    </Button>
                  )}
                  {status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          setTestimonialStatusAction({ id: t.id, status: 'pending' }),
                          'Taken off the website',
                        )
                      }
                    >
                      <RotateCcw /> Take down
                    </Button>
                  )}
                  <ConfirmDialog
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label="Delete">
                        <Trash2 />
                      </Button>
                    }
                    title="Delete this review?"
                    description="It’s removed for good. Reject it instead if you might want it later."
                    onConfirm={() => run(deleteTestimonialAction({ id: t.id }), 'Deleted')}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TestimonialDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function TestimonialDialog({
  item,
  onClose,
  onSaved,
}: {
  item: TestimonialRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { form, submit, pending } = useActionForm({
    schema: testimonialInput,
    defaultValues: {
      authorName: item?.authorName ?? '',
      relation: item?.relation ?? 'parent',
      programTitle: item?.programTitle ?? '',
      rating: item?.rating ? String(item.rating) : '',
      quote: item?.quote ?? '',
      youtube: item?.youtube ?? '',
      photoUrl: item?.photoUrl ?? '',
      featured: item?.featured ?? false,
      studentIds: item?.students.map((x) => x.id) ?? [],
    },
    action: (data) => saveTestimonialAction({ id: item?.id ?? null, data }),
    successMessage: item ? 'Saved' : 'Added and shown on the website',
    onSuccess: onSaved,
  })
  const c = form.control
  const [tagged, setTagged] = useState<PickedStudent[]>(item?.students ?? [])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit review' : 'Add a review'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'Fix typos only — keep the person’s words.'
              : 'For reviews collected in person or on Google, with the person’s permission. It goes live straight away.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <FieldRow>
              <TextField
                control={c}
                name="authorName"
                label="Name"
                placeholder="Priya S."
                description="First name and initial is enough."
              />
              <SelectField
                control={c}
                name="relation"
                label="They are a"
                options={TESTIMONIAL_RELATIONS.map((r) => ({
                  value: r,
                  label: TESTIMONIAL_RELATION_LABELS[r],
                }))}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                control={c}
                name="programTitle"
                label="Program (optional)"
                placeholder="Kathak Foundations"
              />
              <SelectField
                control={c}
                name="rating"
                label="Rating (optional)"
                options={[
                  { value: '', label: 'No rating' },
                  ...[5, 4, 3, 2, 1].map((n) => ({
                    value: String(n),
                    label: `${n} star${n === 1 ? '' : 's'}`,
                  })),
                ]}
              />
            </FieldRow>
            <TextareaField control={c} name="quote" label="Their words" rows={5} />
            <StudentPicker
              id="testimonial-students"
              label="Dancers mentioned or shown (optional)"
              value={tagged}
              onChange={(next) => {
                setTagged(next)
                form.setValue(
                  'studentIds',
                  next.map((x) => x.id),
                  { shouldDirty: true },
                )
              }}
              help="Publishing needs each tagged dancer’s family to have given a current photo and video release."
            />
            <TextField
              control={c}
              name="youtube"
              label="Video review on YouTube (optional)"
              placeholder="https://youtu.be/…"
            />
            <SwitchField
              control={c}
              name="featured"
              label="Feature this review"
              description="Featured reviews show first on the homepage."
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} {item ? 'Save' : 'Add review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
