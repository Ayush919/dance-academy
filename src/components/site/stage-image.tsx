import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Deterministic small integer from a string, for art-direction variety without randomness. */
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const OPTIMISED_HOSTS = new Set(['res.cloudinary.com'])

/**
 * Image slot for public pages. With a photo it renders a responsive, lazy-loaded image (optimised
 * when it comes from the media CDN). Without one it renders a designed stage-light panel with the
 * label in display type, so pages look finished before the academy uploads photography.
 */
export function StageImage({
  src,
  alt,
  label,
  sizes = '(min-width: 1024px) 33vw, 100vw',
  priority,
  className,
  rounded = true,
  labelClassName,
}: {
  src?: string | null
  alt: string
  /** Shown large in the fallback panel. */
  label: string
  sizes?: string
  priority?: boolean
  className?: string
  rounded?: boolean
  labelClassName?: string
}) {
  const frame = cn('relative overflow-hidden bg-card', rounded && 'rounded-2xl', className)

  if (src) {
    let optimised = false
    try {
      optimised = OPTIMISED_HOSTS.has(new URL(src).hostname)
    } catch {
      optimised = src.startsWith('/')
    }
    return (
      <div className={frame}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={!optimised}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      </div>
    )
  }

  const h = hash(label)
  const angle = 160 + (h % 40)
  const x = 20 + (h % 60)
  const tilt = (h % 2 === 0 ? -1 : 1) * (6 + (h % 8))
  return (
    <div className={cn(frame, 'grain @container isolate')} role="img" aria-label={alt}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(70% 90% at ${x}% 0%, color-mix(in oklch, var(--brand) 55%, transparent), transparent 65%), linear-gradient(${angle}deg, color-mix(in oklch, var(--brand) 10%, var(--card)), var(--background))`,
        }}
      />
      <div
        aria-hidden
        className="absolute -top-1/4 h-[150%] w-1/3 opacity-40 blur-2xl"
        style={{
          left: `${x - 15}%`,
          transform: `rotate(${tilt}deg)`,
          background:
            'linear-gradient(180deg, color-mix(in oklch, var(--brand) 70%, white 10%), transparent 80%)',
        }}
      />
      <span
        aria-hidden
        className={cn(
          'type-display absolute -bottom-[0.12em] left-3 text-[30cqw] leading-none whitespace-nowrap text-transparent [-webkit-text-stroke:1px_color-mix(in_oklch,var(--foreground)_35%,transparent)]',
          labelClassName,
        )}
      >
        {label}
      </span>
    </div>
  )
}
