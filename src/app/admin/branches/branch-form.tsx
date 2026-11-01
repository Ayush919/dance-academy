'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TextField } from '@/components/forms/fields'
import { BusinessHoursField, SwitchField, TagsField } from '@/components/forms/more-fields'
import { FieldRow, FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { saveBranchAction } from '@/server/actions/academy'
import { branchInput, type BranchInput } from '@/server/validators/academy'

export const NEW_BRANCH: BranchInput = {
  name: '',
  code: '',
  timezone: 'Asia/Kolkata',
  address: { line1: '', line2: '', area: '', city: '', state: '', postalCode: '' },
  latitude: null,
  longitude: null,
  phone: '',
  email: '',
  whatsapp: '',
  facilities: [],
  businessHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
    weekday === 0
      ? { weekday, closed: true }
      : { weekday, closed: false, open: '07:00', close: '21:00' },
  ),
  isActive: true,
}

export function BranchForm({
  id,
  initial,
  readOnly,
}: {
  id: string | null
  initial: BranchInput
  readOnly?: boolean
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: branchInput,
    defaultValues: initial,
    action: (data) => saveBranchAction({ id, data }),
    successMessage: id ? 'Branch updated' : 'Branch created',
    onSuccess: (res) => {
      if (!id) router.push(`/admin/branches/${res.id}`)
      router.refresh()
    },
  })
  const c = form.control

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly} className="contents">
        <FormSection
          title="Branch"
          description="How the branch appears on the website, receipts and schedules."
        >
          <FieldRow>
            <TextField control={c} name="name" label="Name" placeholder="Andheri West" />
            <TextField
              control={c}
              name="code"
              label="Short code"
              placeholder="AND"
              description="Used in batch codes and document numbers."
              className="uppercase"
            />
          </FieldRow>
          <TextField
            control={c}
            name="timezone"
            label="Timezone"
            description="Class times are set in this timezone. IANA name, e.g. Asia/Kolkata."
          />
          <SwitchField
            control={c}
            name="isActive"
            label="Open"
            description="Closed branches are hidden from the website and booking."
          />
        </FormSection>

        <FormSection title="Address" description="Shown on the website with directions.">
          <TextField
            control={c}
            name="address.line1"
            label="Address line"
            autoComplete="address-line1"
          />
          <TextField
            control={c}
            name="address.line2"
            label="Address line 2 (optional)"
            autoComplete="address-line2"
          />
          <FieldRow>
            <TextField control={c} name="address.area" label="Area / locality" />
            <TextField control={c} name="address.city" label="City" autoComplete="address-level2" />
          </FieldRow>
          <FieldRow>
            <TextField
              control={c}
              name="address.state"
              label="State"
              autoComplete="address-level1"
            />
            <TextField
              control={c}
              name="address.postalCode"
              label="PIN code"
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </FieldRow>
          <FieldRow>
            <TextField
              control={c}
              name="latitude"
              label="Latitude (optional)"
              inputMode="decimal"
              placeholder="19.1351"
            />
            <TextField
              control={c}
              name="longitude"
              label="Longitude (optional)"
              inputMode="decimal"
              placeholder="72.8347"
            />
          </FieldRow>
        </FormSection>

        <FormSection title="Contact" description="Families reach this branch directly.">
          <FieldRow>
            <TextField control={c} name="phone" label="Phone" type="tel" inputMode="tel" />
            <TextField control={c} name="whatsapp" label="WhatsApp" type="tel" inputMode="tel" />
          </FieldRow>
          <TextField control={c} name="email" label="Email" type="email" />
        </FormSection>

        <FormSection title="Facilities & hours">
          <TagsField
            control={c}
            name="facilities"
            label="Facilities"
            placeholder="Sprung floor, Mirrors, Changing rooms"
          />
          <BusinessHoursField control={c} name="businessHours" label="Opening hours" />
        </FormSection>
      </fieldset>

      {!readOnly && (
        <FormFooter>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />} {id ? 'Save changes' : 'Create branch'}
          </Button>
        </FormFooter>
      )}
    </form>
  )
}
