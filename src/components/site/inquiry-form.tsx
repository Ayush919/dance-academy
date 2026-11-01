'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { CircleCheck, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { CheckboxField, TextareaField, TextField } from '@/components/forms/fields'
import { SelectField, type Option } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { submitInquiryAction } from '@/server/actions/public'
import { INQUIRY_TOPIC_LABELS, INQUIRY_TOPICS, type InquiryTopic } from '@/server/domain/enums'
import { inquiryInput } from '@/server/validators/public'

/**
 * Contact / trial-request form. Stored for the team to follow up; Phase 7 replaces the trial
 * variant with live slot booking.
 */
export function InquiryForm({
  mode,
  branches,
  programs,
  initial,
  whatsapp,
}: {
  mode: 'contact' | 'trial'
  branches: Option[]
  programs: Option[]
  initial?: { topic?: InquiryTopic; programSlug?: string; batchCode?: string; branchId?: string }
  whatsapp?: string | null
}) {
  const pathname = usePathname()
  const [sent, setSent] = useState(false)
  const [startedAt] = useState(() => Date.now())

  const { form, submit, pending } = useActionForm({
    schema: inquiryInput,
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      topic: mode === 'trial' ? 'trial' : (initial?.topic ?? 'general'),
      branchId: initial?.branchId ?? '',
      programSlug: initial?.programSlug ?? '',
      batchCode: initial?.batchCode ?? '',
      dancerAge: '',
      preferredTimes: '',
      message: '',
      consent: false,
      company: '',
      startedAt,
      page: pathname,
    },
    action: (data) => submitInquiryAction({ ...data, startedAt, page: pathname }),
    onSuccess: () => setSent(true),
  })
  const c = form.control

  if (sent) {
    return (
      <div
        className="border-foreground/10 flex flex-col items-start gap-4 rounded-2xl border p-8"
        role="status"
      >
        <CircleCheck className="text-brand size-10" />
        <h2 className="type-display text-4xl">
          {mode === 'trial' ? 'Request received.' : 'Message received.'}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {mode === 'trial'
            ? 'The studio team will confirm a trial slot with you shortly, usually within one working day.'
            : 'Thanks for getting in touch. We’ll reply within one working day.'}
        </p>
        {whatsapp && (
          <Button asChild variant="stage-outline" className="rounded-full">
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle /> Can’t wait? WhatsApp us
            </a>
          </Button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FieldRow>
          <TextField
            control={c}
            name="name"
            label={mode === 'trial' ? 'Your name' : 'Name'}
            autoComplete="name"
          />
          <TextField
            control={c}
            name="phone"
            label="Mobile (WhatsApp)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
        </FieldRow>
        <TextField
          control={c}
          name="email"
          label="Email (optional)"
          type="email"
          autoComplete="email"
        />
        {mode === 'contact' && (
          <SelectField
            control={c}
            name="topic"
            label="What’s it about?"
            options={INQUIRY_TOPICS.map((t) => ({ value: t, label: INQUIRY_TOPIC_LABELS[t] }))}
          />
        )}
        <FieldRow>
          <SelectField
            control={c}
            name="programSlug"
            label={mode === 'trial' ? 'Program' : 'Program (optional)'}
            options={programs}
            placeholder="Not sure yet"
          />
          <SelectField
            control={c}
            name="branchId"
            label="Studio"
            options={branches}
            placeholder="Either studio"
          />
        </FieldRow>
        {mode === 'trial' && (
          <FieldRow>
            <TextField
              control={c}
              name="dancerAge"
              label="Dancer’s age"
              type="number"
              inputMode="numeric"
              min={2}
              max={99}
            />
            <TextField
              control={c}
              name="preferredTimes"
              label="Best days / times"
              placeholder="Weekday evenings"
            />
          </FieldRow>
        )}
        <TextareaField
          control={c}
          name="message"
          label={mode === 'trial' ? 'Anything we should know? (optional)' : 'Message'}
          rows={4}
        />
        {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Company
            <input tabIndex={-1} autoComplete="off" {...form.register('company')} />
          </label>
        </div>
        <CheckboxField
          control={c}
          name="consent"
          label="You can contact me about classes by phone, WhatsApp or email."
        />
      </FieldGroup>
      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full sm:w-fit"
        disabled={pending}
      >
        {pending && <Spinner />} {mode === 'trial' ? 'Request my free trial' : 'Send message'}
      </Button>
    </form>
  )
}
