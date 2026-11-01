'use server'

import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import { feePlanHistory } from '@/server/services/catalog'

/** Read-only actions used by client components that load on demand (drawers, previews). */
export const feePlanHistoryAction = defineAction(
  z.object({ planKey: z.string().min(1) }),
  ({ planKey }) => feePlanHistory(planKey),
)
