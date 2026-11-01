import type { Metadata } from 'next'
import { Suspense } from 'react'
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel'

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } }

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailPanel />
    </Suspense>
  )
}
