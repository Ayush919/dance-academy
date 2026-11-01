'use client'

import { useRouter } from 'next/navigation'
import { Archive } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { TextareaField, TextField } from '@/components/forms/fields'
import {
  MultiCheckField,
  SelectField,
  SwitchField,
  TagsField,
  type Option,
} from '@/components/forms/more-fields'
import { FieldRow, FormFooter, FormSection } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { MediaInput } from '@/components/admin/media/media-picker'
import { slugify } from '@/lib/slug'
import { archiveProgramAction, saveProgramAction } from '@/server/actions/academy'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  LEVEL_LABELS,
  LEVELS,
  MODE_LABELS,
  MODES,
} from '@/server/domain/enums'
import { programInput, type ProgramInput } from '@/server/validators/academy'

export const NEW_PROGRAM: ProgramInput = {
  title: '',
  slug: '',
  style: '',
  summary: '',
  description: '',
  highlights: [],
  level: 'beginner',
  ageMin: 8,
  ageMax: null,
  mode: 'offline',
  sessionMinutes: 60,
  durationWeeks: null,
  prerequisites: '',
  requiredDocuments: [],
  instructorIds: [],
  feePlanKeys: [],
  coverImageUrl: '',
  coverImageAlt: '',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
  featured: false,
  sortOrder: 0,
}

export function ProgramForm({
  id,
  initial,
  instructors,
  feePlans,
  readOnly,
}: {
  id: string | null
  initial: ProgramInput
  instructors: Option[]
  feePlans: Option[]
  readOnly?: boolean
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: programInput,
    defaultValues: initial,
    action: (data) => saveProgramAction({ id, data }),
    successMessage: id ? 'Program saved' : 'Program created',
    onSuccess: (res) => {
      if (!id) router.push(`/admin/programs/${res.id}`)
      router.refresh()
    },
  })
  const c = form.control
  const title = form.watch('title')
  const slug = form.watch('slug')
  const [coverUrl, coverAlt] = form.watch(['coverImageUrl', 'coverImageAlt'])

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly} className="contents">
        <FormSection title="Basics" description="The essentials families scan first.">
          <TextField control={c} name="title" label="Title" placeholder="Hip-Hop Foundations" />
          <FieldRow>
            <TextField
              control={c}
              name="style"
              label="Dance style"
              placeholder="Hip-Hop"
              description="Used for website filters."
            />
            <TextField
              control={c}
              name="slug"
              label="Web address"
              placeholder={slugify(title || 'hip-hop-foundations')}
              description={`/programs/${slug || slugify(title) || '…'}`}
            />
          </FieldRow>
          <TextareaField
            control={c}
            name="summary"
            label="Summary"
            rows={2}
            description="One or two sentences for cards and search results."
          />
          <TextareaField
            control={c}
            name="description"
            label="Full description"
            rows={6}
            description="Separate paragraphs with a blank line."
          />
          <TagsField
            control={c}
            name="highlights"
            label="Highlights"
            placeholder="Live music, Showcase every term, Small groups"
          />
        </FormSection>

        <FormSection title="Who it’s for" description="Used to match dancers with the right batch.">
          <FieldRow>
            <SelectField
              control={c}
              name="level"
              label="Level"
              options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
            />
            <SelectField
              control={c}
              name="mode"
              label="Format"
              options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            />
          </FieldRow>
          <FieldRow>
            <TextField control={c} name="ageMin" label="Minimum age" type="number" min={2} />
            <TextField
              control={c}
              name="ageMax"
              label="Maximum age (optional)"
              type="number"
              min={2}
            />
          </FieldRow>
          <FieldRow>
            <TextField
              control={c}
              name="sessionMinutes"
              label="Class length (minutes)"
              type="number"
              min={15}
              step={5}
            />
            <TextField
              control={c}
              name="durationWeeks"
              label="Course length (weeks, optional)"
              type="number"
              min={1}
              description="Leave empty for ongoing programs."
            />
          </FieldRow>
          <TextareaField
            control={c}
            name="prerequisites"
            label="Prerequisites (optional)"
            rows={2}
          />
        </FormSection>

        <FormSection title="Teaching & pricing">
          <MultiCheckField
            control={c}
            name="requiredDocuments"
            label="Documents families must upload before enrolling"
            options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }))}
            empty=""
          />
          <MultiCheckField
            control={c}
            name="instructorIds"
            label="Instructors"
            options={instructors}
            empty="Add instructors first."
          />
          <MultiCheckField
            control={c}
            name="feePlanKeys"
            label="Fee plans"
            options={feePlans}
            empty="Create fee plans first."
          />
        </FormSection>

        <FormSection title="Website" description="How the program appears on the public site.">
          <MediaInput
            label="Cover image"
            value={{ url: coverUrl ?? '', alt: coverAlt ?? '' }}
            invalid={!!form.formState.errors.coverImageAlt}
            onChange={(v) => {
              form.setValue('coverImageUrl', v.url, { shouldDirty: true })
              form.setValue('coverImageAlt', v.alt, {
                shouldDirty: true,
                shouldValidate: !!form.formState.errors.coverImageAlt,
              })
            }}
          />
          {(form.formState.errors.coverImageUrl ?? form.formState.errors.coverImageAlt) && (
            <p className="text-destructive -mt-2 text-sm">
              {
                (form.formState.errors.coverImageUrl ?? form.formState.errors.coverImageAlt)
                  ?.message
              }
            </p>
          )}
          <TextField
            control={c}
            name="seoTitle"
            label="Search title (optional)"
            description="Up to 70 characters. Defaults to the program title."
          />
          <TextareaField
            control={c}
            name="seoDescription"
            label="Search description (optional)"
            rows={2}
            description="Up to 170 characters. Defaults to the summary."
          />
          <FieldRow>
            <SelectField
              control={c}
              name="status"
              label="Status"
              options={[
                { value: 'draft', label: 'Draft — hidden' },
                { value: 'published', label: 'Published — on the website' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <TextField
              control={c}
              name="sortOrder"
              label="Order"
              type="number"
              min={0}
              description="Lower numbers appear first."
            />
          </FieldRow>
          <SwitchField control={c} name="featured" label="Feature on the homepage" />
        </FormSection>
      </fieldset>

      {!readOnly && (
        <FormFooter>
          {id && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" className="mr-auto">
                  <Archive /> Archive
                </Button>
              }
              title="Archive this program?"
              description="It disappears from the website and can’t get new batches. Refused while batches still run."
              confirmLabel="Archive"
              onConfirm={async () => {
                const res = await archiveProgramAction({ id })
                if (!res.ok) {
                  toast.error(res.error.message)
                  return false
                }
                toast.success('Program archived')
                router.refresh()
              }}
            />
          )}
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />} {id ? 'Save changes' : 'Create program'}
          </Button>
        </FormFooter>
      )}
    </form>
  )
}
