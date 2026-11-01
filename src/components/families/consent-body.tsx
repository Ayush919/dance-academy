/** Consent text with the site's safe mini-markup: `## heading`, `- list item`, blank-line paragraphs. */
export function ConsentBody({ body }: { body: string }) {
  const blocks = body.trim().split(/\n{2,}/)
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <ul key={i} className="list-disc pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          )
        if (block.startsWith('## '))
          return (
            <h4 key={i} className="font-heading font-semibold">
              {block.slice(3)}
            </h4>
          )
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        )
      })}
    </div>
  )
}
