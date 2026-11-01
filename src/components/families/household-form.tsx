'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TextField } from '@/components/forms/fields'
import { SelectField } from '@/components/forms/more-fields'
import { FieldRow, FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { CONTACT_CHANNEL_LABELS, CONTACT_CHANNELS } from '@/server/domain/enums'
import { saveHouseholdAction } from '@/server/actions/families'
import { householdInput, type HouseholdInput } from '@/server/validators/families'

export const NEW_HOUSEHOLD: HouseholdInput = {
  name: '',
  billing: { name: '', line1: '', city: '', state: '', postalCode: '', email: '', phone: '' },
  preferredChannel: 'email',
}

/** Family name, billing details and how they like to be contacted. Families and staff both use it. */
export function HouseholdForm({
  id,
  initial,
  afterSave,
  cancelHref,
}: {
  id: string | null
  initial: HouseholdInput
  /** `{id}` is replaced with the family id. Omit to stay on the page. */
  afterSave?: string
  cancelHref?: string
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: householdInput,
    defaultValues: initial,
    action: (data) => saveHouseholdAction({ id, data }),
    successMessage: 'Saved',
    onSuccess: (res) => {
      if (afterSave) router.push(afterSave.replace('{id}', res.id))
      router.refresh()
    },
  })
  const c = form.control
  return (
    <form onSubmit={submit} noValidate>
      <FormSection title="Family" description="How your family appears on invoices and emails.">
        <TextField control={c} name="name" label="Family name" placeholder="The Rao family" />
        <SelectField
          control={c}
          name="preferredChannel"
          label="Preferred way to hear from us"
          options={CONTACT_CHANNELS.map((ch) => ({ value: ch, label: CONTACT_CHANNEL_LABELS[ch] }))}
        />
      </FormSection>
      <FormSection
        title="Billing details"
        description="Printed on receipts and invoices. Optional."
      >
        <TextField control={c} name="billing.name" label="Billing name" />
        <FieldRow>
          <TextField control={c} name="billing.email" label="Billing email" type="email" />
          <TextField
            control={c}
            name="billing.phone"
            label="Billing phone"
            type="tel"
            inputMode="tel"
          />
        </FieldRow>
        <TextField control={c} name="billing.line1" label="Address" />
        <FieldRow>
          <TextField control={c} name="billing.city" label="City" />
          <TextField control={c} name="billing.state" label="State" />
        </FieldRow>
        <TextField
          control={c}
          name="billing.postalCode"
          label="PIN code"
          inputMode="numeric"
          className="sm:max-w-40"
        />
      </FormSection>
      <FormFooter>
        {cancelHref && (
          <Button type="button" variant="ghost" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />} {id ? 'Save changes' : 'Create family'}
        </Button>
      </FormFooter>
    </form>
  )
}
