import type { Metadata } from 'next'
import { InstructorCard } from '@/components/site/cards/instructor-card'
import { PageHero } from '@/components/site/page-hero'
import { Container } from '@/components/site/sections/primitives'
import { getPublicInstructors } from '@/server/services/public'

export const metadata: Metadata = {
  title: 'Instructors',
  description: 'Meet the dancers and choreographers who teach at Remo Dance Company.',
  alternates: { canonical: '/instructors' },
}

export default async function InstructorsPage() {
  const instructors = await getPublicInstructors()
  return (
    <>
      <PageHero
        eyebrow="Instructors"
        lines={['Taught by']}
        accent="people who perform."
        description="Our team teaches what they do on stage, in studios and on set — and they’re great at helping beginners get there too."
      />
      <main id="main-content">
        <Container className="pb-24">
          <ul className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
            {instructors.map((i) => (
              <li key={i.id}>
                <InstructorCard instructor={i} />
              </li>
            ))}
          </ul>
        </Container>
      </main>
    </>
  )
}
