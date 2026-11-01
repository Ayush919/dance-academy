/** The 11-character video id from any common YouTube link (or a bare id), else null. */
export function youtubeId(input: string): string | null {
  const v = input.trim()
  if (/^[\w-]{11}$/.test(v)) return v
  const m =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(
      v,
    )
  return m?.[1] ?? null
}
