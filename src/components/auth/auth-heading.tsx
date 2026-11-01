export function AuthHeading({
  title,
  description,
}: {
  title: string
  description?: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <h1 className="type-display text-display-md">{title}</h1>
      {description && <p className="text-muted-foreground mt-3 text-sm">{description}</p>}
    </div>
  )
}
