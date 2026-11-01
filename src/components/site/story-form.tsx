'use client'

import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { CheckboxField, TextareaField, TextField } from '@/components/forms/fields'
import { SelectField, type Option } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { submitTestimonialAction } from '@/server/actions/website'
import {
  TESTIMONIAL_RELATION_LABELS,
  TESTIMONIAL_RELATIONS,
  testimonialSubmission,
} from '@/server/validators/website'

/** Public review form. Submissions wait for staff approval before they appear anywhere. */
export function StoryForm({ programs }: { programs: Option[] }) {
  const [sent, setSent] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const { form, submit, pending } = useActionForm({
    schema: testimonialSubmission,
    defaultValues: {
      authorName: '',
      relation: 'parent',
      programTitle: '',
      rating: '',
      quote: '',
      contact: '',
      consent: false,
      company: '',
      startedAt,
    },
    action: (data) => submitTestimonialAction({ ...data, startedAt }),
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
        <h2 className="type-display text-4xl">Thank you.</h2>
        <p className="text-muted-foreground max-w-md">
          Your story means a lot to the whole team. We read every one, and it may appear on the
          website once it’s been reviewed.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FieldRow>
          <TextField
            control={c}
            name="authorName"
            label="Your name"
            autoComplete="name"
            description="We show your first name and initial."
          />
          <SelectField
            control={c}
            name="relation"
            label="I’m a"
            options={TESTIMONIAL_RELATIONS.map((r) => ({
              value: r,
              label: TESTIMONIAL_RELATION_LABELS[r],
            }))}
          />
        </FieldRow>
        <FieldRow>
          <SelectField
            control={c}
            name="programTitle"
            label="Program (optional)"
            options={programs}
            placeholder="Choose a program"
          />
          <SelectField
            control={c}
            name="rating"
            label="Rating (optional)"
            options={[5, 4, 3, 2, 1].map((n) => ({
              value: String(n),
              label: `${'★'.repeat(n)} ${n}/5`,
            }))}
            placeholder="No rating"
          />
        </FieldRow>
        <TextareaField
          control={c}
          name="quote"
          label="Your story"
          rows={6}
          placeholder="What has dancing with us meant to you or your child?"
        />
        <TextField
          control={c}
          name="contact"
          label="Email or phone (optional)"
          autoComplete="email"
          description="Only so we can thank you or ask before featuring it. Never shown."
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
          label="You may show my words and first name on your website and social media."
        />
      </FieldGroup>
      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full sm:w-fit"
        disabled={pending}
      >
        {pending && <Spinner />} Send my story
      </Button>
    </form>
  )
}
