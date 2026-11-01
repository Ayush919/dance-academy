'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { MultiCheckField, SelectField, SwitchField } from '@/components/forms/more-fields'
import { TextareaField, TextField } from '@/components/forms/fields'
import { FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import {
  CONSENT_REQUIRED_FOR,
  CONSENT_REQUIRED_LABELS,
  CONSENT_TYPE_LABELS,
  CONSENT_TYPES,
} from '@/server/domain/enums'
import { saveTemplateAction } from '@/server/actions/consents'
import { consentTemplateInput, type ConsentTemplateInput } from '@/server/validators/families'

export const NEW_TEMPLATE: ConsentTemplateInput = {
  type: 'custom',
  title: '',
  body: '',
  requiredFor: ['enrolment'],
  isActive: true,
}

export function ConsentForm({
  templateKey,
  initial,
  version,
  signatures,
}: {
  templateKey: string | null
  initial: ConsentTemplateInput
  version?: number
  signatures?: number
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: consentTemplateInput,
    defaultValues: initial,
    action: (data) => saveTemplateAction({ key: templateKey, data }),
    successMessage: (r) =>
      r.newVersion
        ? `Saved as version ${r.version}. Families will be asked to sign again.`
        : 'Saved',
    onSuccess: () => {
      router.push('/admin/consents')
      router.refresh()
    },
  })
  const c = form.control
  return (
    <form onSubmit={submit} noValidate>
      <FormSection
        title="The form"
        description="Plain text. Start a line with ## for a heading or - for a bullet."
      >
        <TextField control={c} name="title" label="Title" />
        <SelectField
          control={c}
          name="type"
          label="Type"
          options={CONSENT_TYPES.map((t) => ({ value: t, label: CONSENT_TYPE_LABELS[t] }))}
        />
        <TextareaField control={c} name="body" label="Full text families agree to" rows={14} />
        {templateKey && (
          <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
            This is version {version}
            {signatures
              ? ` with ${signatures} current signature${signatures === 1 ? '' : 's'}`
              : ''}
            . Changing the title or wording saves a <strong>new version</strong>: existing
            signatures stay on the old words, and families are asked to sign again.
          </p>
        )}
      </FormSection>
      <FormSection title="When it’s needed">
        <MultiCheckField
          control={c}
          name="requiredFor"
          label="Required before"
          options={CONSENT_REQUIRED_FOR.map((r) => ({
            value: r,
            label: CONSENT_REQUIRED_LABELS[r],
          }))}
          empty=""
        />
        <SwitchField
          control={c}
          name="isActive"
          label="Offer this form to families"
          description="Turn off to retire it without deleting any signatures."
        />
      </FormSection>
      <FormFooter>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/consents')}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />} Save form
        </Button>
      </FormFooter>
    </form>
  )
}
