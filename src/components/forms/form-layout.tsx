import { cn } from '@/lib/utils'

/** Two-column form block: what this group is about on the left, its fields on the right. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'grid gap-6 border-b py-8 first:pt-0 last:border-b-0 lg:grid-cols-[18rem_1fr] lg:gap-10',
        className,
      )}
    >
      <div>
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}

export function FieldRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('grid gap-5 sm:grid-cols-2', className)}>{children}</div>
}

/** Save bar that stays visible at the bottom of long forms. */
export function FormFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {children}
    </div>
  )
}
