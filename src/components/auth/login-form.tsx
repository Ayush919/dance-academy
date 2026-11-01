'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { PasswordField, TextField } from '@/components/forms/fields'
import { useActionForm } from '@/components/forms/use-action-form'
import { authClient, toResult } from '@/lib/auth-client'
import { hardNavigate } from '@/lib/navigation'
import { safeNextPath, signInSchema } from '@/server/validators/auth'

export function LoginForm() {
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))

  const { form, submit, pending } = useActionForm({
    schema: signInSchema,
    defaultValues: { email: '', password: '' },
    action: async (values) =>
      toResult(await authClient.signIn.email({ email: values.email, password: values.password })),
    onSuccess: () => {
      // Full navigation so the server sees the new session cookie and routes by role.
      hardNavigate(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ''}`)
    },
  })

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
        />
        <PasswordField
          control={form.control}
          name="password"
          label="Password"
          autoComplete="current-password"
        />
        <div className="-mt-3 text-right">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending}>
          {pending && <Spinner />} Sign in
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          New to Remo?{' '}
          <Link
            href="/register"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Create a family account
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
