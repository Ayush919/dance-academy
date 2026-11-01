'use client'

import { registerCloudinaryAssetAction } from '@/server/actions/media'
import type { AssetRow } from '@/server/services/media'

type Mode = 'cloudinary' | 'local' | 'unavailable'

/**
 * Upload one file to the media library. Development: multipart to our server. Production: signed
 * direct upload to Cloudinary, then the server verifies Cloudinary's signature before recording it.
 */
export async function uploadFile(file: File, mode: Mode, folder = 'general'): Promise<AssetRow> {
  if (mode === 'unavailable')
    throw new Error('Media storage is not configured. Add Cloudinary keys.')
  if (mode === 'local') {
    const body = new FormData()
    body.set('file', file)
    body.set('folder', folder)
    const res = await fetch('/api/uploads', { method: 'POST', body })
    const json = (await res.json()) as { ok: boolean; data?: AssetRow; error?: { message: string } }
    if (!json.ok || !json.data) throw new Error(json.error?.message ?? 'Upload failed')
    return json.data
  }
  const signRes = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ folder }),
  })
  const sign = (await signRes.json()) as {
    ok: boolean
    data?: {
      cloudName: string
      apiKey: string
      folder: string
      timestamp: number
      signature: string
    }
    error?: { message: string }
  }
  if (!sign.ok || !sign.data) throw new Error(sign.error?.message ?? 'Could not start upload')
  const body = new FormData()
  body.set('file', file)
  body.set('api_key', sign.data.apiKey)
  body.set('timestamp', String(sign.data.timestamp))
  body.set('folder', sign.data.folder)
  body.set('signature', sign.data.signature)
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sign.data.cloudName}/auto/upload`, {
    method: 'POST',
    body,
  })
  const c = (await up.json()) as Record<string, unknown> & { error?: { message: string } }
  if (!up.ok) throw new Error(c.error?.message ?? 'Upload failed')
  const res = await registerCloudinaryAssetAction({
    publicId: String(c.public_id),
    version: Number(c.version),
    signature: String(c.signature),
    secureUrl: String(c.secure_url),
    resourceType: String(c.resource_type),
    format: String(c.format ?? ''),
    width: typeof c.width === 'number' ? c.width : undefined,
    height: typeof c.height === 'number' ? c.height : undefined,
    bytes: Number(c.bytes),
    originalName: file.name,
    folder,
  })
  if (!res.ok) throw new Error(res.error.message)
  return res.data
}

export const formatBytes = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
