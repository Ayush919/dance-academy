import { connectDb } from '@/server/db/connect'
import { AcademyModel } from '@/server/models/academy'

const cache = new Map<string, string>()

/**
 * The academy this deployment serves. Single-tenant today (from ACADEMY_SLUG); a multi-tenant
 * deployment would resolve it from the request host instead, without touching services.
 */
export async function getDeploymentAcademyId(): Promise<string> {
  const slug = process.env.ACADEMY_SLUG ?? 'remo'
  const hit = cache.get(slug)
  if (hit) return hit
  await connectDb()
  const academy = await AcademyModel.findOne({ slug, status: 'active' }, { _id: 1 }).lean()
  if (!academy) {
    throw new Error(`Academy "${slug}" not found. Run \`npm run seed\` to create it.`)
  }
  const id = academy._id.toString()
  cache.set(slug, id)
  return id
}

export function clearAcademyCache() {
  cache.clear()
}
