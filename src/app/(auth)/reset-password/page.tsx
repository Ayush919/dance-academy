import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthHeading } from '@/components/auth/auth-heading'
import { ResetPasswordForm } from '@/components/auth/password-reset-forms'

export const metadata: Metadata = { title: 'New password', robots: { index: false } }

export default function Page() {
  return (
    <>
      <AuthHeading title="New password" description="Choose a new password for your account." />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  )
}
