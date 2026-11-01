'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { CheckboxField, PasswordField, TextField } from '@/components/forms/fields'
import { useActionForm } from '@/components/forms/use-action-form'
import { authClient, toResult } from '@/lib/auth-client'
import { hardNavigate } from '@/lib/navigation'
import { signUpSchema } from '@/server/validators/auth'

export function RegisterForm() {
  const { form, submit, pending } = useActionForm({
    schema: signUpSchema,
    defaultValues: { name: '', email: '', phone: '', password: '', acceptTerms: false },
    action: async (values) => {
      // The resolver has already normalised the phone number; send the parsed values.
      const parsed = signUpSchema.parse(values)
      return toResult(
        await authClient.signUp.email({
          name: parsed.name,
          email: parsed.email,
          password: parsed.password,
          phone: parsed.phone,
        }),
      )
    },
    onSuccess: (data) => {
      // With email verification on, Better Auth returns no session token until the email is confirmed.
      const signedIn = !!(data as { token?: string | null } | null)?.token
      hardNavigate(signedIn ? '/auth/continue' : '/verify-email?sent=1')
    },
  })

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <TextField
          control={form.control}
          name="name"
          label="Your full name"
          autoComplete="name"
          autoFocus
        />
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
        />
        <TextField
          control={form.control}
          name="phone"
          label="Mobile (WhatsApp)"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="98200 00000"
          description="For class reminders and updates. We never share it."
        />
        <PasswordField
          control={form.control}
          name="password"
          label="Password"
          autoComplete="new-password"
          description="At least 10 characters, with letters and numbers."
        />
        <CheckboxField
          control={form.control}
          name="acceptTerms"
          label="I agree to the terms and the privacy policy."
        />
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending}>
          {pending && <Spinner />} Create account
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
