'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TextareaField, TextField } from '@/components/forms/fields'
import {
  MultiCheckField,
  SlotsField,
  SwitchField,
  TagsField,
  type Option,
} from '@/components/forms/more-fields'
import { FieldRow, FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { MediaInput } from '@/components/admin/media/media-picker'
import { saveInstructorAction } from '@/server/actions/academy'
import { instructorInput, type InstructorInput } from '@/server/validators/academy'

export const NEW_INSTRUCTOR: InstructorInput = {
  name: '',
  title: '',
  bio: '',
  specialties: [],
  experienceYears: null,
  achievements: [],
  instagram: '',
  youtube: '',
  website: '',
  photoUrl: '',
  email: '',
  phone: '',
  branchIds: [],
  availability: [],
  payNotes: '',
  isPublic: true,
  isActive: true,
}

export function InstructorForm({
  id,
  initial,
  branches,
  readOnly,
  showPayNotes,
}: {
  id: string | null
  initial: InstructorInput
  branches: Option[]
  readOnly?: boolean
  showPayNotes: boolean
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: instructorInput,
    defaultValues: initial,
    action: (data) => saveInstructorAction({ id, data }),
    successMessage: id ? 'Instructor saved' : 'Instructor added',
    onSuccess: (res) => {
      if (!id) router.push(`/admin/instructors/${res.id}`)
      router.refresh()
    },
  })
  const c = form.control
  const photoUrl = form.watch('photoUrl')

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly} className="contents">
        <FormSection title="Profile" description="Shown on the website when the profile is public.">
          <FieldRow>
            <TextField control={c} name="name" label="Name" />
            <TextField control={c} name="title" label="Title" placeholder="Head of Hip-Hop" />
          </FieldRow>
          <TagsField
            control={c}
            name="specialties"
            label="Dance styles"
            placeholder="Hip-Hop, Popping, Krump"
          />
          <TextField
            control={c}
            name="experienceYears"
            label="Years of experience"
            type="number"
            min={0}
          />
          <TextareaField control={c} name="bio" label="Bio" rows={5} />
          <TagsField
            control={c}
            name="achievements"
            label="Achievements"
            placeholder="World of Dance finalist, Choreographed for …"
          />
          {/* The instructor's name is used as the photo's alt text. */}
          <MediaInput
            label="Photo"
            value={{ url: photoUrl ?? '', alt: '' }}
            withAlt={false}
            onChange={(v) => form.setValue('photoUrl', v.url, { shouldDirty: true })}
          />
          {form.formState.errors.photoUrl && (
            <p className="text-destructive -mt-2 text-sm">
              {form.formState.errors.photoUrl.message}
            </p>
          )}
          <FieldRow>
            <TextField
              control={c}
              name="instagram"
              label="Instagram"
              placeholder="https://instagram.com/…"
            />
            <TextField
              control={c}
              name="youtube"
              label="YouTube"
              placeholder="https://youtube.com/@…"
            />
          </FieldRow>
          <SwitchField control={c} name="isPublic" label="Show on the website" />
        </FormSection>

        <FormSection
          title="Teaching"
          description="Where and when they can take classes. Scheduling warns when a batch falls outside these hours."
        >
          <MultiCheckField control={c} name="branchIds" label="Branches" options={branches} />
          <SlotsField
            control={c}
            name="availability"
            label="Weekly availability"
            addLabel="Add availability"
            emptyText="No hours set — treated as available any time."
            defaultSlot={{ weekday: 1, startTime: '16:00', endTime: '21:00' }}
          />
          <SwitchField
            control={c}
            name="isActive"
            label="Active"
            description="Inactive instructors can’t be assigned to batches."
          />
        </FormSection>

        <FormSection title="Contact" description="Private to staff.">
          <FieldRow>
            <TextField control={c} name="email" label="Email" type="email" />
            <TextField control={c} name="phone" label="Phone" type="tel" />
          </FieldRow>
          {showPayNotes && (
            <TextareaField
              control={c}
              name="payNotes"
              label="Pay notes"
              rows={3}
              description="Visible only to people who manage instructors."
            />
          )}
        </FormSection>
      </fieldset>
      {!readOnly && (
        <FormFooter>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />} {id ? 'Save changes' : 'Add instructor'}
          </Button>
        </FormFooter>
      )}
    </form>
  )
}
