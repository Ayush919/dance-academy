import Link from 'next/link'
import type { PublicInstructor } from '@/server/services/public'
import { StageImage } from '../stage-image'
import { initials } from '../format'

export function InstructorCard({ instructor }: { instructor: PublicInstructor }) {
  return (
    <Link
      href={`/instructors/${instructor.slug}`}
      className="group flex flex-col gap-4 outline-none"
    >
      <StageImage
        src={instructor.photo}
        alt={`Portrait of ${instructor.name}`}
        label={initials(instructor.name)}
        className="aspect-[3/4]"
        labelClassName="text-[60cqw]"
        sizes="(min-width: 1024px) 25vw, 50vw"
      />
      <div>
        <h3 className="type-display group-hover:text-brand text-2xl transition-colors">
          {instructor.name}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {instructor.title || instructor.specialties.slice(0, 2).join(' · ')}
          {instructor.experienceYears ? ` · ${instructor.experienceYears} yrs` : ''}
        </p>
      </div>
    </Link>
  )
}
