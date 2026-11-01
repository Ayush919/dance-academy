'use client'

import { useTransition } from 'react'
import { useForm, type DefaultValues, type FieldValues, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { Result } from '@/server/lib/result'

/**
 * React Hook Form wired to a Server Action that returns the standard Result shape.
 * Validates on the client with the same Zod schema the server uses, maps server field errors back
 * onto inputs, and shows a toast for anything else.
 */
export function useActionForm<In extends FieldValues, Out extends FieldValues, T>({
  schema,
  action,
  defaultValues,
  successMessage,
  onSuccess,
}: {
  schema: z.ZodType<Out, In>
  action: (input: In) => Promise<Result<T>>
  defaultValues: DefaultValues<In>
  successMessage?: string | ((data: T) => string)
  onSuccess?: (data: T) => void | Promise<void>
}) {
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  })
  const [pending, startTransition] = useTransition()

  const submit = form.handleSubmit(
    // Validated on the client, but the action receives the RAW input: the server parses it again
    // with the same schema, and transforms must not run twice (e.g. rupees → paise would ×100).
    () =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          const result = await action(form.getValues())
          if (result.ok) {
            const message =
              typeof successMessage === 'function' ? successMessage(result.data) : successMessage
            if (message) toast.success(message)
            await onSuccess?.(result.data)
          } else {
            const { fields, message } = result.error
            if (fields) {
              for (const [name, msg] of Object.entries(fields)) {
                form.setError(name as Path<In>, { type: 'server', message: msg })
              }
            }
            // Always say something: a field error can belong to an input that isn't on screen.
            const firstField = fields ? Object.values(fields)[0] : undefined
            toast.error(firstField && Object.keys(fields!).length === 1 ? firstField : message)
          }
          resolve()
        })
      }),
  )

  return { form, submit, pending: pending || form.formState.isSubmitting }
}
