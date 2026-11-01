'use client'

import { useState } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Textarea } from '@/components/ui/textarea'

interface BaseProps<T extends FieldValues> {
  control: Control<T, unknown, FieldValues>
  name: Path<T>
  label: string
  description?: React.ReactNode
  className?: string
}

type InputProps = Omit<React.ComponentProps<'input'>, 'name' | 'defaultValue' | 'value'>

/** Labelled text input with description and inline error, accessible by default. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: BaseProps<T> & InputProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            {...input}
            {...field}
            value={field.value ?? ''}
            id={field.name}
            aria-invalid={fieldState.invalid}
            aria-describedby={description ? `${field.name}-desc` : undefined}
          />
          {description && (
            <FieldDescription id={`${field.name}-desc`}>{description}</FieldDescription>
          )}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** Password input with a show/hide toggle. */
export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: BaseProps<T> & InputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              {...input}
              {...field}
              value={field.value ?? ''}
              id={field.name}
              type={visible ? 'text' : 'password'}
              aria-invalid={fieldState.invalid}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...textarea
}: BaseProps<T> & Omit<React.ComponentProps<'textarea'>, 'name' | 'defaultValue' | 'value'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Textarea
            {...textarea}
            {...field}
            value={field.value ?? ''}
            id={field.name}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function CheckboxField<T extends FieldValues>({
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
      render={({ field, fieldState }) => (
        <Field orientation="horizontal" data-invalid={fieldState.invalid} className={className}>
          <Checkbox
            id={field.name}
            checked={!!field.value}
            onCheckedChange={(v) => field.onChange(v === true)}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          <FieldContent>
            <FieldLabel htmlFor={field.name} className="font-normal">
              {label}
            </FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </FieldContent>
        </Field>
      )}
    />
  )
}
