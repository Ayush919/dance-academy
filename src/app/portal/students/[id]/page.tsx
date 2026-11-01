import Link from 'next/link'
import { Suspense } from 'react'
import { WaitlistCard } from '@/components/families/offer-card'
import { ConsentPanel } from '@/components/families/consent-panel'
import { DocumentsPanel } from '@/components/families/documents-panel'
import { StudentForm } from '@/components/families/student-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { studentConsents } from '@/server/services/consents'
import { listStudentDocuments } from '@/server/services/documents'
import { getStudent } from '@/server/services/families'
import { studentClasses } from '@/server/services/portal-data'

export const metadata = { title: 'Dancer' }

export default function StudentPage({ params }: PageProps<'/portal/students/[id]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Student params={params} />
    </Suspense>
  )
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

async function Student({ params }: Pick<PageProps<'/portal/students/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const s = await getStudent(id)
    const [consents, docs, { classes, waitlist }] = await Promise.all([
      studentConsents(id),
      listStudentDocuments(id),
      studentClasses(id),
    ])
    const ref = { householdId: s.householdId, studentId: id }
    const canEdit = can(actor, 'students.manage', ref)
    const canSign = can(actor, 'consents.sign', ref)
    const canDocs = can(actor, 'documents.manage', ref)
    return (
      <div className="flex flex-col gap-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/portal"
              className="text-muted-foreground text-sm underline underline-offset-4"
            >
              ← My family
            </Link>
            <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight">{s.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{s.age} years old</p>
          </div>
          <Button asChild>
            <Link href="/classes">Find a class</Link>
          </Button>
        </div>

        <section className="flex flex-col gap-4" id="classes">
          <h2 className="font-heading text-xl font-semibold">Classes</h2>
          {classes.length === 0 && waitlist.length === 0 && (
            <p className="text-muted-foreground text-sm">Not in a class yet.</p>
          )}
          {waitlist.map((w) => (
            <WaitlistCard key={w.id} line={w} studentName={s.name} />
          ))}
          {classes.length > 0 && (
            <ul className="bg-card divide-y rounded-xl border">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="mr-auto min-w-0">
                    <p className="font-medium">{c.program}</p>
                    <p className="text-muted-foreground text-sm">
                      {c.batch} · {c.schedule} · {c.branch}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      From {fmtDate(c.startDate)}
                      {c.endDate && ` to ${fmtDate(c.endDate)}`}
                    </p>
                  </div>
                  <Badge
                    variant={c.status === 'active' ? 'secondary' : 'outline'}
                    className={c.status === 'active' ? 'bg-success/12 text-success' : ''}
                  >
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex scroll-mt-24 flex-col gap-4" id="forms">
          <h2 className="font-heading text-xl font-semibold">Forms</h2>
          <ConsentPanel studentId={id} rows={consents} canSign={canSign} signerName={actor!.name} />
        </section>

        <section className="flex scroll-mt-24 flex-col gap-4" id="documents">
          <h2 className="font-heading text-xl font-semibold">Documents</h2>
          <p className="text-muted-foreground -mt-2 text-sm">
            Kept private. Only you and the studio team can see them.
          </p>
          <DocumentsPanel studentId={id} docs={docs} canManage={canDocs} />
        </section>

        <section className="flex scroll-mt-24 flex-col gap-2" id="details">
          <h2 className="font-heading text-xl font-semibold">Details</h2>
          <StudentForm
            id={id}
            initial={{
              name: s.name,
              dob: s.dob,
              gender: (s.gender as '') ?? '',
              medicalNotes: s.medicalNotes ?? '',
              emergencyContacts: s.emergencyContacts.length
                ? s.emergencyContacts
                : [{ name: '', relationship: '', phone: '' }],
              isSelf: s.isSelf,
            }}
            canSeeMedical={s.canSeeMedical}
            readOnly={!canEdit}
            cancelHref="/portal"
          />
        </section>
      </div>
    )
  })
}
