import mongoose from 'mongoose'

type Tasks<T extends readonly unknown[]> = { [K in keyof T]: () => Promise<T[K]> }

export function inTransaction(): boolean {
  const store = (
    mongoose as unknown as {
      transactionAsyncLocalStorage?: { getStore(): { session?: unknown } | undefined }
    }
  ).transactionAsyncLocalStorage?.getStore()
  return !!store?.session
}

/**
 * Like Promise.all for independent reads, but sequential inside a transaction: MongoDB does not
 * allow concurrent operations on one transaction's session.
 */
export async function all<T extends readonly unknown[]>(tasks: Tasks<T>): Promise<T> {
  if (!inTransaction()) return Promise.all(tasks.map((t) => t())) as unknown as Promise<T>
  const out: unknown[] = []
  for (const t of tasks) out.push(await t())
  return out as unknown as T
}
