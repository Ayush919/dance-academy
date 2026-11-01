import { BrandMark } from '@/components/site/brand-mark'

/** Stage-themed split layout for sign-in flows: editorial panel on large screens, form on the right. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div
      data-theme="stage"
      className="bg-background text-foreground grid min-h-dvh lg:grid-cols-[1.1fr_1fr]"
    >
      <aside className="grain relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 70% at 20% 10%, color-mix(in oklch, var(--brand) 55%, transparent) 0%, transparent 60%), radial-gradient(50% 60% at 90% 100%, color-mix(in oklch, var(--brand) 25%, transparent) 0%, transparent 70%)',
          }}
        />
        <BrandMark />
        <div>
          <p className="type-eyebrow text-brand">Mumbai · Pune</p>
          <p className="type-display text-display-lg mt-6">
            Every class
            <br />
            moves you <span className="type-accent text-brand">closer.</span>
          </p>
          <p className="text-muted-foreground mt-6 max-w-sm text-sm">
            Book classes, follow your progress, and manage fees for the whole family in one place.
          </p>
        </div>
        <p className="text-muted-foreground text-xs">© Remo Dance Company</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-10 lg:justify-center lg:px-16">
        <BrandMark className="mb-10 lg:hidden" />
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
