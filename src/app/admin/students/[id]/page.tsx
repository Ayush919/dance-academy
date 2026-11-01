import Link from 'next/link'
import { Suspense } from 'react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { StatusBadge } from '@/components/admin/status-badge'
import { ConsentPanel } from '@/components/families/consent-panel'
import { DocumentsPanel } from '@/components/families/documents-panel'
import { EnrolmentActions, StaffEnrolDialog } from '@/components/families/staff-enrol'
import { StudentForm } from '@/components/families/student-form'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { studentConsents } from '@/server/services/consents'
import { listStudentDocuments } from '@/server/services/documents'
import { getStudent, styleOptions } from '@/server/services/families'
import { studentClasses } from '@/server/services/portal-data'
import { StudentControls } from './student-controls'

export const metadata = { title: 'Student' }

export default function StudentPage({ params }: PageProps<'/admin/students/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Student params={params} />
    </Suspense>
  )
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

async function Student({ params }: Pick<PageProps<'/admin/students/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const s = await getStudent(id)
    const [consents, docs, { classes, waitlist }, styles] = await Promise.all([
      studentConsents(id),
      listStudentDocuments(id),
      studentClasses(id),
      styleOptions(),
    ])
    const ref = { householdId: s.householdId, studentId: id, branchIds: s.branchIds }
    const manage = can(actor, 'students.manage', ref)
    const canEnrol = can(actor, 'enrollments.request', ref)
    const canManageConsents = can(actor, 'consents.manage')
    const canDocs = can(actor, 'documents.manage', ref)
    return (
      <div className="flex flex-col gap-12">
        <CrumbLabel segment={id} label={s.name} />
        <PageHeader
          title={s.name}
          description={`${s.age} years old`}
          actions={
            <>
              <StatusBadge status={s.status} />
              <Link
                href={`/admin/families/${s.householdId}`}
                className="text-sm underline underline-offset-4"
              >
                View family
              </Link>
            </>
          }
        />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Classes</h2>
            {canEnrol && (
              <StaffEnrolDialog student={{ id, name: s.name }} trigger="Enrol in a batch" />
            )}
          </div>
          {classes.length === 0 && waitlist.length === 0 && (
            <p className="text-muted-foreground text-sm">Not enrolled in any class.</p>
          )}
          {classes.length > 0 && (
            <ul className="bg-card divide-y rounded-xl border">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="mr-auto min-w-0">
                    <Link
                      href={`/admin/enrollments/batches/${c.batchId}`}
                      className="font-medium hover:underline"
                    >
                      {c.program}
                    </Link>
                    <p className="text-muted-foreground text-sm">
                      {c.batch} · {c.schedule} · {c.branch}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      From {fmtDate(c.startDate)}
                      {c.endDate && ` to ${fmtDate(c.endDate)}`}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                  {can(actor, 'enrollments.manage', ref) && (
                    <EnrolmentActions
                      enrollmentId={c.id}
                      status={c.status}
                      currentBatchId={c.batchId}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {waitlist.map((w) => (
            <p key={w.id} className="text-muted-foreground text-sm">
              On the waitlist for <strong>{w.program}</strong> ({w.schedule}):{' '}
              {w.status === 'offered' ? 'a seat has been offered.' : `place ${w.position}.`}
            </p>
          ))}
        </section>

        {manage && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-xl font-semibold">Studio settings</h2>
            <StudentControls
              id={id}
              status={s.status as 'active'}
              levels={s.levels}
              styles={styles}
            />
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Forms</h2>
          {canManageConsents && (
            <p className="text-muted-foreground -mt-2 text-sm">
              Recording a signature here is for paper forms the family handed in.
            </p>
          )}
          <ConsentPanel studentId={id} rows={consents} canSign={canManageConsents} staff />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Documents</h2>
          <DocumentsPanel studentId={id} docs={docs} canManage={canDocs} staff />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold">Details</h2>
          {!s.canSeeMedical && (
            <p className="text-muted-foreground text-sm">
              Medical notes are hidden from your role.
            </p>
          )}
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
            readOnly={!manage}
            cancelHref="/admin/students"
          />
        </section>
      </div>
    )
  })
}
