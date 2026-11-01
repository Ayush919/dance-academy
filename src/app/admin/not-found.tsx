import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/empty-state'

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="This page doesn’t exist, or the module hasn’t been switched on yet."
      action={
        <Button asChild variant="outline">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      }
      className="py-20"
    />
  )
}
