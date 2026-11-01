import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { PublicProgram } from '@/server/services/public'
import { FEW_SEATS } from '@/server/services/public-constants'
import { StageImage } from '../stage-image'
import { ages, levelLabel, price } from '../format'

export function ProgramCard({ program, priority }: { program: PublicProgram; priority?: boolean }) {
  const few = program.batchCount > 0 && program.seatsLeft > 0 && program.seatsLeft <= FEW_SEATS
  return (
    <Link
      href={`/programs/${program.slug}`}
      className="group focus-visible:ring-ring flex flex-col gap-4 rounded-2xl outline-none focus-visible:ring-2"
    >
      <div className="relative">
        <StageImage
          src={program.coverImage.url}
          alt={program.coverImage.alt}
          label={program.style}
          priority={priority}
          className="aspect-[4/5]"
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 85vw"
        />
        <span className="bg-background/70 absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-medium backdrop-blur">
          {levelLabel(program.level)}
        </span>
        {few && (
          <span className="bg-brand text-brand-foreground absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold">
            {program.seatsLeft} seats left
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-eyebrow text-muted-foreground">{program.style}</p>
          <h3 className="type-display group-hover:text-brand mt-2 text-2xl transition-colors sm:text-3xl">
            {program.title}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {ages(program.ageMin, program.ageMax)} · {program.sessionMinutes} min
            {program.branches.length > 0 &&
              ` · ${program.branches
                .map((b) => b.city)
                .filter((c, i, a) => a.indexOf(c) === i)
                .join(', ')}`}
          </p>
        </div>
        <ArrowUpRight className="text-muted-foreground group-hover:text-brand mt-1 size-5 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <p className="text-sm font-medium">From {price(program.price)}</p>
    </Link>
  )
}
