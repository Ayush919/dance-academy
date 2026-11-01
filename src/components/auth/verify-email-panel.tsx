'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MailCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/states/empty-state'
import { authClient, toResult } from '@/lib/auth-client'

export function VerifyEmailPanel() {
  const params = useSearchParams()
  const failed = params.get('error')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)

  const resend = async () => {
    if (!email) return
    setPending(true)
    const res = toResult(
      await authClient.sendVerificationEmail({ email, callbackURL: '/auth/continue' }),
    )
    setPending(false)
    if (res.ok) toast.success('If that email needs confirming, a new link is on its way.')
    else toast.error(res.error.message)
  }

  return (
    <div className="flex flex-col gap-6">
      <EmptyState
        icon={failed ? TriangleAlert : MailCheck}
        title={failed ? 'That link didn’t work' : 'Confirm your email'}
        description={
          failed
            ? 'The confirmation link is invalid or has expired. Send yourself a new one below.'
            : 'We’ve sent you a confirmation link. Open it on this device to finish setting up your account.'
        }
      />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void resend()
        }}
      >
        <Input
          type="email"
          aria-label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Button type="submit" variant="stage-outline" disabled={pending || !email}>
          {pending && <Spinner />} Resend
        </Button>
      </form>
      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground text-center text-sm"
      >
        Back to sign in
      </Link>
    </div>
  )
}
