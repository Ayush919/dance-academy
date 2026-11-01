'use client'

import { nanoid } from 'nanoid'
import { Controller, useFieldArray, type Control, type FieldValues } from 'react-hook-form'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MediaInput } from '@/components/admin/media/media-picker'
import {
  brandForeground,
  contrast,
  isValidHref,
  type FieldDef,
  type LinkRef,
  type MediaRef,
} from '@/content/schema'

type Ctl = Control<FieldValues>

/** Paths offered when typing a link (pages, programs…). */
export interface LinkSuggestion {
  value: string
  label: string
}

export function LinkSuggestions({ id, items }: { id: string; items: LinkSuggestion[] }) {
  return (
    <datalist id={id}>
      {items.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </datalist>
  )
}

/** Renders any list of field definitions (see src/content/schema.ts) bound to a form path. */
export function ContentFields({
  fields,
  base,
  control,
}: {
  fields: FieldDef[]
  base: string
  control: Ctl
}) {
  return (
    <div className="flex flex-col gap-5">
      {fields.map((f) => (
        <ContentField key={f.name} field={f} path={`${base}${f.name}`} control={control} />
      ))}
    </div>
  )
}

function ContentField({
  field: f,
  path,
  control,
}: {
  field: FieldDef
  path: string
  control: Ctl
}) {
  const id = path.replace(/\W+/g, '-')
  const help = 'help' in f && f.help ? <FieldDescription>{f.help}</FieldDescription> : null
  const req =
    'required' in f && f.required ? (
      <span className="text-destructive" aria-hidden>
        {' '}
        *
      </span>
    ) : null

  switch (f.kind) {
    case 'text':
    case 'number':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={id}>
                {f.label}
                {req}
              </FieldLabel>
              <Input
                id={id}
                type={f.kind === 'number' ? 'number' : 'text'}
                min={f.kind === 'number' ? f.min : undefined}
                max={f.kind === 'number' ? f.max : undefined}
                maxLength={f.kind === 'text' ? f.max : undefined}
                placeholder={f.kind === 'text' ? f.placeholder : undefined}
                list={f.kind === 'text' && f.suggestLinks ? 'cms-link-suggestions' : undefined}
                value={(field.value as string | number | undefined) ?? ''}
                onChange={(e) =>
                  field.onChange(f.kind === 'number' ? Number(e.target.value) : e.target.value)
                }
                onBlur={field.onBlur}
              />
              {help}
            </Field>
          )}
        />
      )
    case 'textarea':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={id}>
                {f.label}
                {req}
              </FieldLabel>
              <Textarea
                id={id}
                rows={f.rows ?? 4}
                maxLength={f.max}
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
              {help}
            </Field>
          )}
        />
      )
    case 'color':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <ColorInput
              id={id}
              label={f.label}
              value={(field.value as string) ?? '#FF4A2B'}
              onChange={field.onChange}
            />
          )}
        />
      )
    case 'switch':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <Field orientation="horizontal" className="rounded-lg border p-3">
              <FieldLabel htmlFor={id} className="flex-1">
                {f.label}
              </FieldLabel>
              <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      )
    case 'select':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              <select
                id={id}
                value={(field.value as string) ?? f.options[0]!.value}
                onChange={field.onChange}
                className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {help}
            </Field>
          )}
        />
      )
    case 'image':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <div>
              <MediaInput
                label={`${f.label}${'required' in f && f.required ? ' *' : ''}`}
                value={(field.value as MediaRef) ?? { url: '', alt: '' }}
                onChange={field.onChange}
                invalid
              />
              {help}
            </div>
          )}
        />
      )
    case 'link':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => {
            const v = (field.value as LinkRef) ?? { label: '', href: '' }
            const bad = !!v.href && !isValidHref(v.href)
            return (
              <FieldSet>
                <FieldLegend variant="label">
                  {f.label}
                  {req}
                </FieldLegend>
                <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                  <Input
                    aria-label={`${f.label} label`}
                    placeholder="Button text"
                    value={v.label}
                    maxLength={60}
                    onChange={(e) => field.onChange({ ...v, label: e.target.value })}
                  />
                  <Input
                    aria-label={`${f.label} link`}
                    aria-invalid={bad}
                    placeholder="/programs or https://…"
                    list="cms-link-suggestions"
                    value={v.href}
                    onChange={(e) => field.onChange({ ...v, href: e.target.value })}
                  />
                </div>
                {bad && (
                  <p className="text-destructive text-sm">
                    Use a site path like /programs or a full https:// link.
                  </p>
                )}
                {help}
              </FieldSet>
            )
          }}
        />
      )
    case 'lines':
      return (
        <Controller
          control={control}
          name={path}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={id}>
                {f.label}
                {req}
              </FieldLabel>
              <LinesInput
                id={id}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
              />
              <FieldDescription>{('help' in f && f.help) || 'One per line.'}</FieldDescription>
            </Field>
          )}
        />
      )
    case 'list':
      return <ListField field={f} path={path} control={control} />
  }
}

/** Textarea edited as one entry per line; keeps blank trailing lines while typing. */
function LinesInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <Textarea
      id={id}
      rows={Math.max(2, value.length + 1)}
      value={value.join('\n')}
      onChange={(e) => onChange(e.target.value.split('\n').slice(0, 30))}
      onBlur={() => onChange(value.map((l) => l.trim()).filter(Boolean))}
    />
  )
}

function ListField({
  field: f,
  path,
  control,
}: {
  field: Extract<FieldDef, { kind: 'list' }>
  path: string
  control: Ctl
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: path, keyName: '_key' })
  const blank = () =>
    Object.fromEntries([
      ['id', nanoid(8)],
      ...f.fields.map((s) => [
        s.name,
        s.kind === 'switch'
          ? false
          : s.kind === 'lines'
            ? []
            : s.kind === 'image'
              ? { url: '', alt: '' }
              : s.kind === 'link'
                ? { label: '', href: '' }
                : s.kind === 'number'
                  ? s.min
                  : s.kind === 'select'
                    ? s.options[0]!.value
                    : '',
      ]),
    ])
  return (
    <FieldSet>
      <FieldLegend variant="label">{f.label}</FieldLegend>
      {f.help && <FieldDescription>{f.help}</FieldDescription>}
      <ol className="flex flex-col gap-3">
        {fields.map((item, i) => (
          <li key={item._key} className="bg-muted/30 rounded-lg border p-3">
            <div className="mb-3 flex items-center gap-1">
              <span className="text-muted-foreground mr-auto text-xs font-medium tracking-wide uppercase">
                {f.itemLabel} {i + 1}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Move down"
                disabled={i === fields.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${f.itemLabel.toLowerCase()} ${i + 1}`}
                onClick={() => remove(i)}
              >
                <Trash2 />
              </Button>
            </div>
            <ContentFields fields={f.fields} base={`${path}.${i}.`} control={control} />
          </li>
        ))}
      </ol>
      {fields.length < (f.max ?? 30) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => append(blank())}
        >
          <Plus /> Add {f.itemLabel.toLowerCase()}
        </Button>
      )}
    </FieldSet>
  )
}

/** Brand colour with live WCAG contrast feedback against the dark site and its button text. */
function ColorInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  const fg = valid ? brandForeground(value) : null
  const onDark = valid ? contrast(value, '#0B0B0C') : 0
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : '#FF4A2B'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-10 cursor-pointer rounded-md border bg-transparent"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 font-mono uppercase"
          maxLength={7}
          aria-invalid={!valid}
        />
        {valid && (
          <span
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: value, color: fg ?? '#0B0B0C' }}
          >
            Book a trial
          </span>
        )}
      </div>
      <FieldDescription>
        {!valid
          ? 'Use a hex colour like #FF4A2B.'
          : `${fg ? 'Button text reads well (≥4.5:1)' : 'Button text is hard to read — choose a lighter or darker shade'} · ${onDark >= 3 ? 'stands out on the dark site' : 'too dark for the dark site background'} (${onDark.toFixed(1)}:1).`}
      </FieldDescription>
    </Field>
  )
}
