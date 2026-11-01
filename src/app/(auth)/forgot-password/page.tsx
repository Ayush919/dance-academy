import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthHeading } from '@/components/auth/auth-heading'
import { ForgotPasswordForm } from '@/components/auth/password-reset-forms'

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } }

export default function Page() {
  return (
    <>
      <AuthHeading
        title="Reset password"
        description="Enter your email and we’ll send you a link to choose a new password."
      />
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </>
  )
}
