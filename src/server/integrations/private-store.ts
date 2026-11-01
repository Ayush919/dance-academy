import 'server-only'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { signParams } from './media-store'

/**
 * Storage for files that must never have a public URL (student documents). Production uses
 * Cloudinary's `authenticated` delivery type, fetched server-side with a signed request; development
 * writes under `.data/private`, which is outside `public/` and is never served directly.
 * Either way the browser only ever receives bytes from our own permission-checked route.
 */
export type PrivateProvider = 'local' | 'cloudinary'

export function privateMode(): PrivateProvider | 'unavailable' {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
    return 'cloudinary'
  return process.env.NODE_ENV === 'production' ? 'unavailable' : 'local'
}

const LOCAL_ROOT = path.join(process.cwd(), '.data', 'private')
const localPath = (key: string) => {
  const abs = path.join(LOCAL_ROOT, key)
  if (!abs.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Invalid path')
  return abs
}

export async function savePrivate(
  academyId: string,
  ext: string,
  bytes: Uint8Array,
  mime: string,
): Promise<{ provider: PrivateProvider; storageKey: string }> {
  const mode = privateMode()
  if (mode === 'unavailable')
    throw new Error('Document storage is not configured: set the CLOUDINARY_* variables')
  const name = nanoid(24)
  if (mode === 'local') {
    const key = `${academyId}/${name}.${ext}`
    const abs = localPath(key)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, bytes, { flag: 'wx' })
    return { provider: 'local', storageKey: key }
  }
  const publicId = `${academyId}/documents/${name}`
  const timestamp = Math.floor(Date.now() / 1000)
  const params = { public_id: publicId, timestamp, type: 'authenticated' }
  const form = new FormData()
  form.set('file', new Blob([bytes as BlobPart], { type: mime }), `${name}.${ext}`)
  for (const [k, v] of Object.entries(params)) form.set(k, String(v))
  form.set('api_key', process.env.CLOUDINARY_API_KEY!)
  form.set('signature', signParams(params))
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: form },
  )
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`)
  const out = (await res.json()) as { public_id: string; resource_type: string; format?: string }
  return {
    provider: 'cloudinary',
    storageKey: `${out.resource_type}|${out.public_id}|${out.format ?? ext}`,
  }
}

export async function readPrivate(
  provider: PrivateProvider,
  storageKey: string,
): Promise<Uint8Array> {
  if (provider === 'local') return new Uint8Array(await readFile(localPath(storageKey)))
  const [resourceType, publicId, format] = storageKey.split('|') as [string, string, string]
  const timestamp = Math.floor(Date.now() / 1000)
  const params = {
    expires_at: timestamp + 300,
    format,
    public_id: publicId,
    timestamp,
    type: 'authenticated',
  }
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/download`,
  )
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  url.searchParams.set('api_key', process.env.CLOUDINARY_API_KEY!)
  url.searchParams.set('signature', signParams(params))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cloudinary download failed (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function deletePrivate(provider: PrivateProvider, storageKey: string) {
  if (provider === 'local') {
    await unlink(localPath(storageKey)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e
    })
    return
  }
  const [resourceType, publicId] = storageKey.split('|') as [string, string]
  const timestamp = Math.floor(Date.now() / 1000)
  const params = { public_id: publicId, timestamp, type: 'authenticated' }
  const body = new URLSearchParams({
    public_id: publicId,
    type: 'authenticated',
    timestamp: String(timestamp),
    api_key: process.env.CLOUDINARY_API_KEY!,
    signature: signParams(params),
  })
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
    { method: 'POST', body },
  )
  if (!res.ok) throw new Error(`Cloudinary delete failed (${res.status})`)
}
