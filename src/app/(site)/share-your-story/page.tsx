import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHero } from '@/components/site/page-hero'
import { StoryForm } from '@/components/site/story-form'
import { Container } from '@/components/site/sections/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { getCatalogue } from '@/server/services/public'

export const metadata: Metadata = {
  title: 'Share your story',
  description: 'Tell us what dancing with Remo Dance Company has meant to you or your family.',
  alternates: { canonical: '/share-your-story' },
}

export default function ShareYourStoryPage() {
  return (
    <>
      <PageHero
        eyebrow="Share your story"
        lines={['Tell us']}
        accent="everything."
        description="Students, parents and alumni — your words help the next family find their way to the studio."
      />
      <main id="main-content">
        <Container className="max-w-3xl pb-20">
          <Suspense
            fallback={<Skeleton className="bg-foreground/5 h-[32rem] w-full rounded-2xl" />}
          >
            <Form />
          </Suspense>
        </Container>
      </main>
    </>
  )
}

async function Form() {
  const { programs } = await getCatalogue()
  return <StoryForm programs={programs.map((p) => ({ value: p.title, label: p.title }))} />
}
