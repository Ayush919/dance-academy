import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthHeading } from '@/components/auth/auth-heading'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Join Remo', robots: { index: false } }

export default function Page() {
  return (
    <>
      <AuthHeading
        title="Join Remo"
        description="One account for your whole family: book classes, track progress and pay fees."
      />
      <Suspense>
        <RegisterForm />
      </Suspense>
    </>
  )
}
