'use server'

import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import { parseListParams } from '@/server/lib/pagination'
import { mediaMode } from '@/server/integrations/media-store'
import {
  ASSET_SORTS,
  assetUsage,
  deleteAsset,
  listAssets,
  registerCloudinaryAsset,
  updateAsset,
} from '@/server/services/media'
import { authorize } from '@/server/rbac/authorize'

const id = z.string().regex(/^[a-f0-9]{24}$/)

export const listAssetsAction = defineAction(
  z.object({
    q: z.string().max(100).default(''),
    page: z.number().int().min(1).default(1),
    kind: z.string().optional(),
    folder: z.string().optional(),
  }),
  ({ q, page, kind, folder }) =>
    listAssets(
      parseListParams<(typeof ASSET_SORTS)[number]>(
        { q, page: String(page), pageSize: '25' },
        { sortable: ASSET_SORTS, defaultSort: '-createdAt' },
      ),
      { kind, folder },
    ),
)

export const mediaModeAction = defineAction(z.object({}), async () => {
  authorize('media.read')
  return { mode: mediaMode() }
})

export const updateAssetAction = defineAction(
  z.object({
    id,
    alt: z.string().max(300),
    caption: z.string().max(300).default(''),
    folder: z.string().max(60).default('general'),
    tags: z.array(z.string().max(40)).max(20).default([]),
    focalX: z.number().min(0).max(1).default(0.5),
    focalY: z.number().min(0).max(1).default(0.5),
  }),
  ({ id: assetId, ...rest }) => updateAsset(assetId, rest),
)

export const assetUsageAction = defineAction(z.object({ id }), ({ id: assetId }) =>
  assetUsage(assetId),
)
export const deleteAssetAction = defineAction(z.object({ id }), ({ id: assetId }) =>
  deleteAsset(assetId),
)

export const registerCloudinaryAssetAction = defineAction(
  z.object({
    publicId: z.string().max(300),
    version: z.number(),
    signature: z.string().max(100),
    secureUrl: z.url(),
    resourceType: z.string().max(20),
    format: z.string().max(20),
    width: z.number().optional(),
    height: z.number().optional(),
    bytes: z.number().int().min(1),
    originalName: z.string().max(200),
    folder: z.string().max(60),
  }),
  (input) => registerCloudinaryAsset(input),
)
