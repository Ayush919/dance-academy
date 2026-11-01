/**
 * Identify an upload by its first bytes, never by its name or the browser's claim. Only formats the
 * site can display safely are allowed — SVG and HTML are refused (they can carry scripts).
 */
export type Sniffed =
  | {
      kind: 'image'
      mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif'
      ext: string
    }
  | { kind: 'video'; mime: 'video/mp4' | 'video/webm' | 'video/quicktime'; ext: string }

const ascii = (b: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...b.subarray(start, start + len))

export function sniff(bytes: Uint8Array): Sniffed | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG')
    return { kind: 'image', mime: 'image/png', ext: 'png' }
  if (ascii(bytes, 0, 4) === 'GIF8') return { kind: 'image', mime: 'image/gif', ext: 'gif' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
    return { kind: 'image', mime: 'image/webp', ext: 'webp' }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
    return { kind: 'video', mime: 'video/webm', ext: 'webm' }
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis')
      return { kind: 'image', mime: 'image/avif', ext: 'avif' }
    if (brand === 'qt  ') return { kind: 'video', mime: 'video/quicktime', ext: 'mov' }
    if (/^(isom|iso2|mp41|mp42|avc1|M4V |dash)/.test(brand))
      return { kind: 'video', mime: 'video/mp4', ext: 'mp4' }
  }
  return null
}

export const MAX_BYTES = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024 } as const

export type SniffedDocument = {
  mime: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'
  ext: string
}

/** Documents a family may upload: PDF and common photo formats (HEIC for phone cameras). */
export function sniffDocument(bytes: Uint8Array): SniffedDocument | null {
  if (bytes.length < 12) return null
  if (ascii(bytes, 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }
  const image = sniff(bytes)
  if (image?.kind === 'image' && image.mime !== 'image/gif' && image.mime !== 'image/avif')
    return { mime: image.mime, ext: image.ext }
  if (ascii(bytes, 4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1)/.test(ascii(bytes, 8, 4)))
    return { mime: 'image/heic', ext: 'heic' }
  return null
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
