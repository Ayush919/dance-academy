import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthHeading } from '@/components/auth/auth-heading'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

export default function Page() {
  return (
    <>
      <AuthHeading
        title="Sign in"
        description="Welcome back. Sign in to manage classes, bookings and fees."
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  )
}
