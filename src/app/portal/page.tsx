import Link from 'next/link'
import { Suspense } from 'react'
import { CalendarDays, FileWarning, Plus, TriangleAlert, Users } from 'lucide-react'
import { EmptyState } from '@/components/states/empty-state'
import { WaitlistCard } from '@/components/families/offer-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { familyOverview } from '@/server/services/portal-data'

export const metadata = { title: 'My family' }

export default function PortalHome() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Overview />
    </Suspense>
  )
}

async function Overview() {
  return withRequestContext(async ({ actor }) => {
    const family = await familyOverview()
    const canEdit = can(actor, 'students.manage', { householdId: actor!.householdId })
    const offers = family.students.flatMap((s) =>
      s.waitlist.filter((w) => w.status === 'offered').map((w) => ({ w, s })),
    )
    const todo = family.students.filter((s) => s.missingConsents > 0 || s.documentIssues > 0)

    return (
      <div className="flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="type-eyebrow text-brand">{family.household?.name ?? 'My family'}</p>
            <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">
              Hi {actor!.name.split(' ')[0]}
            </h1>
            <p className="text-muted-foreground mt-2">
              Classes, forms and bookings for your family, in one place.
            </p>
          </div>
          {canEdit && family.students.length > 0 && (
            <Button asChild variant="outline">
              <Link href="/portal/students/new">
                <Plus /> Add a dancer
              </Link>
            </Button>
          )}
        </div>

        {offers.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Seat offers">
            <h2 className="font-heading text-lg font-semibold">A seat is waiting for you</h2>
            {offers.map(({ w, s }) => (
              <WaitlistCard key={w.id} line={w} studentName={s.name} />
            ))}
          </section>
        )}

        {todo.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="To do">
            <h2 className="font-heading text-lg font-semibold">To do</h2>
            <ul className="flex flex-col gap-2">
              {todo.map((s) => (
                <li
                  key={s.id}
                  className="bg-warning/12 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm"
                >
                  <TriangleAlert className="size-4 shrink-0" />
                  <span className="mr-auto">
                    <strong>{s.name}</strong>
                    {s.missingConsents > 0 &&
                      ` has ${s.missingConsents} form${s.missingConsents === 1 ? '' : 's'} to sign`}
                    {s.missingConsents > 0 && s.documentIssues > 0 && ' and '}
                    {s.documentIssues > 0 &&
                      `${s.documentIssues} document${s.documentIssues === 1 ? '' : 's'} expiring or expired`}
                  </span>
                  <Button asChild size="xs" variant="outline">
                    <Link
                      href={`/portal/students/${s.id}${s.missingConsents > 0 ? '#forms' : '#documents'}`}
                    >
                      Fix now
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {family.students.length === 0 ? (
          <div className="bg-card rounded-2xl border">
            <EmptyState
              icon={Users}
              title="Add your first dancer"
              description="Tell us about the dancer, then pick a class. If you’re joining yourself, register as an adult dancer."
              action={
                canEdit ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link href="/portal/students/new">Add a dancer</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/portal/students/new?self=1">I’m the dancer</Link>
                    </Button>
                  </div>
                ) : undefined
              }
              className="py-14"
            />
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2" aria-label="Dancers">
            {family.students.map((s) => (
              <article key={s.id} className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
                <div className="flex items-start gap-3">
                  <div className="mr-auto min-w-0">
                    <h2 className="font-heading text-lg font-semibold">{s.name}</h2>
                    <p className="text-muted-foreground text-sm">
                      {s.age} years old{s.isSelf && ' · you'}
                    </p>
                  </div>
                  {s.status !== 'active' && <Badge variant="outline">{s.status}</Badge>}
                </div>

                {s.classes.length === 0 && s.waitlist.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Not in a class yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {s.classes.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 text-sm">
                        <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-medium">{c.program}</span>
                          <span className="text-muted-foreground block">
                            {c.schedule} · {c.branch}
                            {c.status === 'paused' && ' · paused'}
                          </span>
                        </span>
                      </li>
                    ))}
                    {s.waitlist
                      .filter((w) => w.status === 'waiting')
                      .map((w) => (
                        <li key={w.id} className="text-muted-foreground text-sm">
                          Waitlist #{w.position}: {w.program} ({w.schedule})
                        </li>
                      ))}
                  </ul>
                )}

                {(s.missingConsents > 0 || s.documentIssues > 0) && (
                  <p className="text-warning-foreground flex items-center gap-2 text-xs">
                    <FileWarning className="size-3.5" /> Needs attention
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/classes">Find a class</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/portal/students/${s.id}`}>Manage</Link>
                  </Button>
                </div>
              </article>
            ))}
          </section>
        )}

        {actor!.role === 'guardian' && (
          <p className="text-muted-foreground text-sm">
            <Link href="/portal/family" className="underline underline-offset-4">
              Family and billing details
            </Link>
          </p>
        )}
      </div>
    )
  })
}
