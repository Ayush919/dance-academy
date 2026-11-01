'use client'

import { useRouter } from 'next/navigation'
import { useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { CheckboxField, TextareaField, TextField } from '@/components/forms/fields'
import { SelectField } from '@/components/forms/more-fields'
import { FieldRow, FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { GENDER_LABELS, GENDERS } from '@/server/domain/enums'
import { saveStudentAction } from '@/server/actions/families'
import { studentInput, type StudentInput } from '@/server/validators/families'

export const NEW_STUDENT: StudentInput = {
  name: '',
  dob: '',
  gender: '',
  medicalNotes: '',
  emergencyContacts: [{ name: '', relationship: '', phone: '' }],
  isSelf: false,
}

/** Add or edit a dancer. Used by families in the portal and by the studio in the admin. */
export function StudentForm({
  id,
  householdId,
  initial,
  canSeeMedical,
  readOnly,
  afterSave,
  cancelHref,
  allowSelf = false,
}: {
  id: string | null
  /** Staff pass the family; guardians never do. */
  householdId?: string
  initial: StudentInput
  canSeeMedical: boolean
  readOnly?: boolean
  /** Where to go after saving; `{id}` is replaced with the student's id. Omit to stay on the page. */
  afterSave?: string
  cancelHref: string
  allowSelf?: boolean
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: studentInput,
    defaultValues: initial,
    action: (data) => saveStudentAction({ id, householdId, data }),
    successMessage: id ? 'Saved' : 'Dancer added',
    onSuccess: (res) => {
      if (afterSave) router.push(afterSave.replace('{id}', res.id))
      router.refresh()
    },
  })
  const c = form.control
  const contacts = useFieldArray({ control: c, name: 'emergencyContacts' })
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly} className="contents">
        <FormSection
          title="About the dancer"
          description="Used for class eligibility and the studio’s records."
        >
          <TextField control={c} name="name" label="Full name" autoComplete="off" />
          <FieldRow>
            <TextField control={c} name="dob" label="Date of birth" type="date" max={today} />
            <SelectField
              control={c}
              name="gender"
              label="Gender (optional)"
              options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
              placeholder="Prefer not to say"
            />
          </FieldRow>
          {allowSelf && !id && (
            <CheckboxField
              control={c}
              name="isSelf"
              label="This is me. I’m 18 or older and I’m registering myself."
            />
          )}
        </FormSection>

        <FormSection
          title="Emergency contacts"
          description="Who the studio should call if a parent can’t be reached. At least one."
        >
          <div className="flex flex-col gap-4">
            {contacts.fields.map((f, i) => (
              <div key={f.id} className="bg-muted/30 rounded-xl border p-4">
                <FieldGroup>
                  <FieldRow>
                    <TextField
                      control={c}
                      name={`emergencyContacts.${i}.name`}
                      label="Name"
                      autoComplete="off"
                    />
                    <TextField
                      control={c}
                      name={`emergencyContacts.${i}.relationship`}
                      label="Relationship"
                      placeholder="Grandmother"
                    />
                  </FieldRow>
                  <TextField
                    control={c}
                    name={`emergencyContacts.${i}.phone`}
                    label="Mobile number"
                    type="tel"
                    inputMode="tel"
                  />
                </FieldGroup>
                {contacts.fields.length > 1 && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="mt-3"
                    onClick={() => contacts.remove(i)}
                  >
                    <Trash2 /> Remove contact
                  </Button>
                )}
              </div>
            ))}
            {contacts.fields.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => contacts.append({ name: '', relationship: '', phone: '' })}
              >
                <Plus /> Add another contact
              </Button>
            )}
          </div>
        </FormSection>

        {canSeeMedical && (
          <FormSection
            title="Health"
            description="Allergies, injuries or conditions instructors should know about. Only the family and authorised staff can read this."
          >
            <TextareaField
              control={c}
              name="medicalNotes"
              label="Medical notes (optional)"
              rows={4}
            />
          </FormSection>
        )}
      </fieldset>
      {!readOnly && (
        <FormFooter>
          <Button type="button" variant="ghost" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />} {id ? 'Save changes' : 'Add dancer'}
          </Button>
        </FormFooter>
      )}
    </form>
  )
}
