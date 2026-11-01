'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MailCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { PasswordField, TextField } from '@/components/forms/fields'
import { useActionForm } from '@/components/forms/use-action-form'
import { EmptyState } from '@/components/states/empty-state'
import { authClient, toResult } from '@/lib/auth-client'
import { hardNavigate } from '@/lib/navigation'
import { forgotPasswordSchema, resetPasswordSchema } from '@/server/validators/auth'

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { form, submit, pending } = useActionForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: '' },
    action: async (values) => {
      const res = toResult(
        await authClient.requestPasswordReset({
          email: values.email,
          redirectTo: '/reset-password',
        }),
      )
      return res.ok ? { ok: true, data: values.email } : res
    },
    onSuccess: (email) => setSentTo(email),
  })

  if (sentTo) {
    // Same message whether or not the account exists, so emails can't be enumerated.
    return (
      <EmptyState
        icon={MailCheck}
        title="Check your inbox"
        description={`If an account exists for ${sentTo}, we’ve sent a link to reset the password. It expires in 30 minutes.`}
        action={
          <Button variant="stage-outline" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        }
      />
    )
  }

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
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending}>
          {pending && <Spinner />} Send reset link
        </Button>
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground text-center text-sm"
        >
          Back to sign in
        </Link>
      </FieldGroup>
    </form>
  )
}

export function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token')
  const linkError = params.get('error')

  const { form, submit, pending } = useActionForm({
    schema: resetPasswordSchema,
    defaultValues: { password: '', confirm: '' },
    action: async (values) =>
      toResult(
        await authClient.resetPassword({ newPassword: values.password, token: token ?? '' }),
      ),
    successMessage: 'Password updated. Sign in with your new password.',
    onSuccess: () => hardNavigate('/login'),
  })

  if (!token || linkError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="This link has expired"
        description="Reset links work once and expire after 30 minutes. Request a new one."
        action={
          <Button variant="brand" asChild>
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        }
      />
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <PasswordField
          control={form.control}
          name="password"
          label="New password"
          autoComplete="new-password"
          description="At least 10 characters, with letters and numbers."
          autoFocus
        />
        <PasswordField
          control={form.control}
          name="confirm"
          label="Confirm password"
          autoComplete="new-password"
        />
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending}>
          {pending && <Spinner />} Update password
        </Button>
      </FieldGroup>
    </form>
  )
}
