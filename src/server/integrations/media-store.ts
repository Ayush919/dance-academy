import 'server-only'
import { createHash } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Where uploaded files live. Cloudinary when configured (production); otherwise the local disk under
 * /public/uploads (development only — serverless hosts have no persistent disk).
 */
export function mediaMode(): 'cloudinary' | 'local' | 'unavailable' {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
    return 'cloudinary'
  return process.env.NODE_ENV === 'production' ? 'unavailable' : 'local'
}

// ── Cloudinary (signed direct uploads; the secret never leaves the server) ──

export function signParams(params: Record<string, string | number>) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1')
    .update(toSign + process.env.CLOUDINARY_API_SECRET)
    .digest('hex')
}

export function cloudinaryUploadSignature(folder: string) {
  const timestamp = Math.floor(Date.now() / 1000)
  const params = { folder, timestamp }
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
    timestamp,
    signature: signParams(params),
  }
}

/** Cloudinary signs its upload response; verifying it proves the client didn't invent the asset. */
export function verifyCloudinaryResponse(
  publicId: string,
  version: number | string,
  signature: string,
) {
  const expected = createHash('sha1')
    .update(`public_id=${publicId}&version=${version}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex')
  return expected === signature
}

export async function cloudinaryDestroy(publicId: string, kind: 'image' | 'video') {
  const timestamp = Math.floor(Date.now() / 1000)
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: process.env.CLOUDINARY_API_KEY!,
    signature: signParams({ public_id: publicId, timestamp }),
  })
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${kind}/destroy`,
    { method: 'POST', body },
  )
  if (!res.ok) throw new Error(`Cloudinary destroy failed (${res.status})`)
}

// ── Local disk (development) ──

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads')

export async function saveLocal(academyId: string, name: string, bytes: Uint8Array) {
  const now = new Date()
  const rel = path.posix.join(
    academyId,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    name,
  )
  const abs = path.join(UPLOAD_ROOT, rel)
  if (!abs.startsWith(UPLOAD_ROOT)) throw new Error('Invalid path')
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, bytes, { flag: 'wx' })
  return { storageKey: rel, url: `/uploads/${rel}` }
}

export async function deleteLocal(storageKey: string) {
  const abs = path.join(UPLOAD_ROOT, storageKey)
  if (!abs.startsWith(UPLOAD_ROOT)) throw new Error('Invalid path')
  await unlink(abs).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e
  })
}
