import 'server-only'
import { Types } from 'mongoose'
import { nanoid } from 'nanoid'
import { imageSize } from 'image-size'
import { requireContext } from '@/server/context/request-context'
import { AppError, notFound } from '@/server/lib/errors'
import { MAX_BYTES, sniff } from '@/server/lib/file-sniff'
import { paginate, searchRegex, type ListParams } from '@/server/lib/pagination'
import { authorize } from '@/server/rbac/authorize'
import { ContentDocumentModel } from '@/server/models/content'
import { EventModel } from '@/server/models/event'
import { InstructorModel } from '@/server/models/instructor'
import { MediaAssetModel, type MediaAsset } from '@/server/models/media-asset'
import { GalleryItemModel, TestimonialModel } from '@/server/models/media-content'
import { ProgramModel } from '@/server/models/program'
import {
  cloudinaryDestroy,
  deleteLocal,
  mediaMode,
  saveLocal,
  verifyCloudinaryResponse,
} from '@/server/integrations/media-store'
import { recordAudit } from './audit'

const toId = (id: string) => new Types.ObjectId(id)

export interface AssetRow {
  id: string
  url: string
  kind: 'image' | 'video'
  format: string
  width: number | null
  height: number | null
  bytes: number
  originalName: string
  alt: string
  caption: string
  folder: string
  tags: string[]
  focalX: number
  focalY: number
  createdAt: string
  uploadedByName: string
}

function row(a: MediaAsset & { _id: Types.ObjectId; createdAt: Date }): AssetRow {
  return {
    id: a._id.toString(),
    url: a.url,
    kind: a.kind,
    format: a.format,
    width: a.width ?? null,
    height: a.height ?? null,
    bytes: a.bytes,
    originalName: a.originalName,
    alt: a.alt,
    caption: a.caption,
    folder: a.folder,
    tags: a.tags,
    focalX: a.focalX,
    focalY: a.focalY,
    createdAt: a.createdAt.toISOString(),
    uploadedByName: a.uploadedByName,
  }
}

export const ASSET_SORTS = ['createdAt', 'originalName', 'bytes'] as const

export async function listAssets(
  params: ListParams<(typeof ASSET_SORTS)[number]>,
  filters: { kind?: string; folder?: string } = {},
) {
  authorize('media.read')
  const filter: Record<string, unknown> = {}
  if (filters.kind === 'image' || filters.kind === 'video') filter.kind = filters.kind
  if (filters.folder) filter.folder = filters.folder
  if (params.q) {
    const rx = searchRegex(params.q)
    filter.$or = [{ originalName: rx }, { alt: rx }, { caption: rx }, { tags: rx }]
  }
  const { rows, meta } = await paginate<MediaAsset & { _id: Types.ObjectId; createdAt: Date }>(
    MediaAssetModel as never,
    filter,
    params,
  )
  const folders = await MediaAssetModel.distinct('folder')
  return { data: rows.map(row), meta, folders: (folders as string[]).sort() }
}

const cleanFolder = (f: string) =>
  f
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'general'

/** Development uploads: validate by content, store on disk, record the asset. */
export async function uploadLocal(file: { name: string; bytes: Uint8Array }, folder = 'general') {
  const actor = authorize('media.upload')
  if (mediaMode() !== 'local')
    throw new AppError('PRECONDITION_FAILED', 'Uploads go to the media CDN in this environment.')
  const type = sniff(file.bytes)
  if (!type)
    throw new AppError(
      'VALIDATION',
      'Use a JPEG, PNG, WebP, GIF or AVIF image, or an MP4/WebM/MOV video.',
    )
  if (file.bytes.byteLength > MAX_BYTES[type.kind]) {
    throw new AppError(
      'VALIDATION',
      `That file is too large (max ${MAX_BYTES[type.kind] / 1024 / 1024} MB for ${type.kind}s).`,
    )
  }
  let dims: { width?: number; height?: number } = {}
  if (type.kind === 'image') {
    try {
      dims = imageSize(file.bytes)
    } catch {
      throw new AppError('VALIDATION', 'That image looks damaged and could not be read.')
    }
    if ((dims.width ?? 0) > 12000 || (dims.height ?? 0) > 12000)
      throw new AppError('VALIDATION', 'Images can be at most 12,000 pixels on a side.')
  }
  const { academyId } = requireContext()
  const stored = await saveLocal(academyId, `${nanoid(14)}.${type.ext}`, file.bytes)
  const asset = await MediaAssetModel.create({
    provider: 'local',
    storageKey: stored.storageKey,
    url: stored.url,
    kind: type.kind,
    format: type.ext,
    mime: type.mime,
    width: dims.width ?? null,
    height: dims.height ?? null,
    bytes: file.bytes.byteLength,
    originalName: file.name.slice(0, 200),
    folder: cleanFolder(folder),
    uploadedBy: actor.userId,
    uploadedByName: actor.name,
  })
  await recordAudit({
    action: 'media.upload',
    entity: 'MediaAsset',
    entityId: asset.id,
    meta: { name: file.name, bytes: file.bytes.byteLength },
  })
  return row(asset.toObject() as never)
}

/** Production uploads: the browser uploaded straight to Cloudinary; record it once its signature checks out. */
export async function registerCloudinaryAsset(input: {
  publicId: string
  version: number
  signature: string
  secureUrl: string
  resourceType: string
  format: string
  width?: number
  height?: number
  bytes: number
  originalName: string
  folder: string
}) {
  const actor = authorize('media.upload')
  if (mediaMode() !== 'cloudinary')
    throw new AppError('PRECONDITION_FAILED', 'Cloudinary is not configured.')
  if (!verifyCloudinaryResponse(input.publicId, input.version, input.signature))
    throw new AppError('FORBIDDEN', 'Upload could not be verified.')
  const kind = input.resourceType === 'video' ? 'video' : 'image'
  if (
    !input.secureUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)
  )
    throw new AppError('FORBIDDEN', 'Unexpected media URL.')
  if (input.bytes > MAX_BYTES[kind]) throw new AppError('VALIDATION', 'That file is too large.')
  const asset = await MediaAssetModel.create({
    provider: 'cloudinary',
    storageKey: input.publicId,
    url: input.secureUrl,
    kind,
    format: input.format,
    width: input.width ?? null,
    height: input.height ?? null,
    bytes: input.bytes,
    originalName: input.originalName.slice(0, 200),
    folder: cleanFolder(input.folder),
    uploadedBy: actor.userId,
    uploadedByName: actor.name,
  })
  await recordAudit({
    action: 'media.upload',
    entity: 'MediaAsset',
    entityId: asset.id,
    meta: { provider: 'cloudinary' },
  })
  return row(asset.toObject() as never)
}

export async function updateAsset(
  id: string,
  input: {
    alt: string
    caption: string
    folder: string
    tags: string[]
    focalX: number
    focalY: number
  },
) {
  authorize('media.upload')
  const res = await MediaAssetModel.findOneAndUpdate(
    { _id: toId(id) },
    {
      $set: {
        alt: input.alt.trim().slice(0, 300),
        caption: input.caption.trim().slice(0, 300),
        folder: cleanFolder(input.folder),
        tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(
          0,
          20,
        ),
        focalX: Math.min(1, Math.max(0, input.focalX)),
        focalY: Math.min(1, Math.max(0, input.focalY)),
      },
    },
    { returnDocument: 'after' },
  ).lean()
  if (!res) throw notFound('File')
  return row(res as never)
}

/** Everywhere a file is used. Deletion is refused while this list is not empty. */
export async function assetUsage(id: string) {
  authorize('media.read')
  const asset = await MediaAssetModel.findById(toId(id), { url: 1 }).lean()
  if (!asset) throw notFound('File')
  const url = asset.url
  const [pages, programs, instructors, events, gallery, testimonials] = [
    await ContentDocumentModel.find(
      { mediaIds: id, deletedAt: null },
      { title: 1, kind: 1 },
    ).lean(),
    await ProgramModel.find({ 'coverImage.url': url, deletedAt: null }, { title: 1 }).lean(),
    await InstructorModel.find({ 'photo.url': url, deletedAt: null }, { name: 1 }).lean(),
    await EventModel.find({ 'poster.url': url }, { title: 1 }).lean(),
    await GalleryItemModel.countDocuments({ $or: [{ src: url }, { poster: url }] }),
    await TestimonialModel.countDocuments({ photoUrl: url }),
  ]
  return [
    ...pages.map((p) => ({ type: p.kind === 'page' ? 'Page' : 'Website setting', name: p.title })),
    ...programs.map((p) => ({ type: 'Program', name: p.title })),
    ...instructors.map((i) => ({ type: 'Instructor', name: i.name })),
    ...events.map((e) => ({ type: 'Event', name: e.title })),
    ...(gallery ? [{ type: 'Gallery', name: `${gallery} item${gallery === 1 ? '' : 's'}` }] : []),
    ...(testimonials
      ? [{ type: 'Testimonial', name: `${testimonials} review${testimonials === 1 ? '' : 's'}` }]
      : []),
  ]
}

export async function deleteAsset(id: string) {
  authorize('media.delete')
  const usage = await assetUsage(id)
  if (usage.length) {
    throw new AppError(
      'PRECONDITION_FAILED',
      `In use by ${usage.map((u) => `${u.type.toLowerCase()} “${u.name}”`).join(', ')}. Replace it there first.`,
    )
  }
  const asset = await MediaAssetModel.findById(toId(id)).lean()
  if (!asset) throw notFound('File')
  if (asset.provider === 'local') await deleteLocal(asset.storageKey)
  else await cloudinaryDestroy(asset.storageKey, asset.kind)
  await MediaAssetModel.deleteOne({ _id: asset._id })
  await recordAudit({
    action: 'media.delete',
    entity: 'MediaAsset',
    entityId: id,
    before: { url: asset.url, name: asset.originalName },
  })
  return { id }
}
