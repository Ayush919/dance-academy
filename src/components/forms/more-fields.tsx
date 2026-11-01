'use client'

import { useState } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { WEEKDAYS, WEEKDAYS_SHORT } from '@/server/domain/schedule'
import { cn } from '@/lib/utils'

interface BaseProps<T extends FieldValues> {
  control: Control<T, unknown, FieldValues>
  name: Path<T>
  label: string
  description?: React.ReactNode
  className?: string
}

export interface Option {
  value: string
  label: string
  hint?: string
}

/** Collect every nested message under a field (array items, object members). */
function messages(error: unknown): { message?: string }[] {
  if (!error || typeof error !== 'object') return []
  const e = error as Record<string, unknown> & { message?: string; root?: { message?: string } }
  const out: { message?: string }[] = []
  if (typeof e.message === 'string') out.push({ message: e.message })
  if (e.root?.message) out.push({ message: e.root.message })
  for (const [k, v] of Object.entries(e)) {
    if (k !== 'message' && k !== 'root' && k !== 'ref' && k !== 'type' && typeof v === 'object')
      out.push(...messages(v))
  }
  return out
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder = 'Select…',
  disabled,
}: BaseProps<T> & { options: Option[]; placeholder?: string; disabled?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger
              id={field.name}
              aria-invalid={fieldState.invalid}
              onBlur={field.onBlur}
              className="w-full"
            >
              {/* Explicit label: Radix renders the selected text only after the list has mounted. */}
              <SelectValue placeholder={placeholder}>
                {options.find((o) => o.value === field.value)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {o.hint && <span className="text-muted-foreground ml-1 text-xs">{o.hint}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
}: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className={cn('rounded-lg border p-3', className)}>
          <FieldContent>
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldContent>
          <Switch id={field.name} checked={!!field.value} onCheckedChange={field.onChange} />
        </Field>
      )}
    />
  )
}

/** Comma-separated text edited as a list of tags. */
export function TagsField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  placeholder,
}: BaseProps<T> & { placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TagsInput
          id={field.name}
          label={label}
          description={description}
          className={className}
          placeholder={placeholder}
          value={(field.value as string[]) ?? []}
          onChange={field.onChange}
          error={fieldState.error}
        />
      )}
    />
  )
}

function TagsInput({
  id,
  label,
  description,
  className,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  description?: React.ReactNode
  className?: string
  placeholder?: string
  value: string[]
  onChange: (v: string[]) => void
  error?: { message?: string }
}) {
  const [text, setText] = useState(value.join(', '))
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }}
      />
      <FieldDescription>{description ?? 'Separate with commas.'}</FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  )
}

/** A short list of options picked with checkboxes (instructors, fee plans, branches). */
export function MultiCheckField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  empty = 'Nothing to choose yet.',
}: BaseProps<T> & { options: Option[]; empty?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string[]) ?? []
        const toggle = (v: string, on: boolean) =>
          field.onChange(on ? [...value, v] : value.filter((x) => x !== v))
        return (
          <FieldSet data-invalid={fieldState.invalid} className={className}>
            <FieldLegend variant="label">{label}</FieldLegend>
            {description && <FieldDescription>{description}</FieldDescription>}
            <div className="max-h-60 overflow-y-auto rounded-lg border">
              {options.length === 0 && <p className="text-muted-foreground p-3 text-sm">{empty}</p>}
              {options.map((o) => (
                <label
                  key={o.value}
                  className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0"
                >
                  <Checkbox
                    checked={value.includes(o.value)}
                    onCheckedChange={(c) => toggle(o.value, c === true)}
                  />
                  <span className="flex-1">{o.label}</span>
                  {o.hint && <span className="text-muted-foreground text-xs">{o.hint}</span>}
                </label>
              ))}
            </div>
            <FieldError errors={messages(fieldState.error)} />
          </FieldSet>
        )
      }}
    />
  )
}

interface Slot {
  weekday: number
  startTime: string
  endTime: string
}

/** Weekly class times (or availability windows): day + start + end, add and remove rows. */
export function SlotsField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  addLabel = 'Add a time',
  emptyText,
  defaultSlot = { weekday: 1, startTime: '18:00', endTime: '19:00' },
}: BaseProps<T> & { addLabel?: string; emptyText?: string; defaultSlot?: Slot }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const slots = (field.value as Slot[]) ?? []
        const set = (i: number, patch: Partial<Slot>) =>
          field.onChange(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)))
        return (
          <FieldSet data-invalid={fieldState.invalid} className={className}>
            <FieldLegend variant="label">{label}</FieldLegend>
            {description && <FieldDescription>{description}</FieldDescription>}
            <div className="flex flex-col gap-2">
              {slots.length === 0 && emptyText && (
                <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                  {emptyText}
                </p>
              )}
              {slots.map((s, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]"
                >
                  <Select
                    value={String(s.weekday)}
                    onValueChange={(v) => set(i, { weekday: Number(v) })}
                  >
                    <SelectTrigger
                      className="col-span-1 w-full"
                      aria-label={`Day for time ${i + 1}`}
                    >
                      <SelectValue>{WEEKDAYS[s.weekday]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {WEEKDAYS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="sm:order-last"
                    aria-label={`Remove time ${i + 1}`}
                    onClick={() => field.onChange(slots.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                  <Input
                    type="time"
                    step={300}
                    value={s.startTime}
                    aria-label={`Start time ${i + 1}`}
                    onChange={(e) => set(i, { startTime: e.target.value })}
                  />
                  <Input
                    type="time"
                    step={300}
                    value={s.endTime}
                    aria-label={`End time ${i + 1}`}
                    onChange={(e) => set(i, { endTime: e.target.value })}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  const last = slots.at(-1)
                  field.onChange([
                    ...slots,
                    last ? { ...last, weekday: (last.weekday + 2) % 7 } : defaultSlot,
                  ])
                }}
              >
                <Plus /> {addLabel}
              </Button>
            </div>
            <FieldError errors={messages(fieldState.error)} />
          </FieldSet>
        )
      }}
    />
  )
}

interface Hours {
  weekday: number
  closed: boolean
  open?: string
  close?: string
}

export function BusinessHoursField<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hours = (field.value as Hours[]) ?? []
        const set = (weekday: number, patch: Partial<Hours>) =>
          field.onChange(hours.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))
        return (
          <FieldSet data-invalid={fieldState.invalid}>
            <FieldLegend variant="label">{label}</FieldLegend>
            {description && <FieldDescription>{description}</FieldDescription>}
            <div className="divide-y rounded-lg border">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const h = hours.find((x) => x.weekday === d) ?? { weekday: d, closed: true }
                return (
                  <div key={d} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="w-10 text-sm font-medium">{WEEKDAYS_SHORT[d]}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!h.closed}
                        onCheckedChange={(on) =>
                          set(
                            d,
                            on
                              ? {
                                  closed: false,
                                  open: h.open ?? '09:00',
                                  close: h.close ?? '21:00',
                                }
                              : { closed: true },
                          )
                        }
                        aria-label={`Open on ${WEEKDAYS[d]}`}
                      />
                      <span className="text-muted-foreground w-12">
                        {h.closed ? 'Closed' : 'Open'}
                      </span>
                    </label>
                    {!h.closed && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          className="w-28"
                          value={h.open ?? ''}
                          aria-label={`Opens on ${WEEKDAYS[d]}`}
                          onChange={(e) => set(d, { open: e.target.value })}
                        />
                        <span className="text-muted-foreground text-sm">to</span>
                        <Input
                          type="time"
                          className="w-28"
                          value={h.close ?? ''}
                          aria-label={`Closes on ${WEEKDAYS[d]}`}
                          onChange={(e) => set(d, { close: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <FieldError errors={messages(fieldState.error)} />
          </FieldSet>
        )
      }}
    />
  )
}
