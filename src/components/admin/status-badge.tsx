import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STYLES: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-success/12 text-success' },
  active: { label: 'Active', className: 'bg-success/12 text-success' },
  scheduled: { label: 'Scheduled', className: 'bg-success/12 text-success' },
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  paused: {
    label: 'Paused',
    className: 'bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_35%)]',
  },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  transferred: { label: 'Transferred', className: 'bg-muted text-muted-foreground' },
  suspended: { label: 'Suspended', className: 'bg-destructive/10 text-destructive' },
  alumni: { label: 'Alumni', className: 'bg-muted text-muted-foreground' },
  waiting: { label: 'Waiting', className: 'bg-muted text-muted-foreground' },
  offered: { label: 'Seat offered', className: 'bg-brand/15 text-foreground' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STYLES[status] ?? { label: status, className: '' }
  return (
    <Badge variant="secondary" className={cn('font-medium', s.className, className)}>
      {s.label}
    </Badge>
  )
}
