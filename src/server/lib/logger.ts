import { getContext } from '@/server/context/request-context'

type Level = 'debug' | 'info' | 'warn' | 'error'

function write(level: Level, message: string, data?: Record<string, unknown>) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return
  const ctx = getContext()
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    requestId: ctx?.requestId,
    academyId: ctx?.academyId,
    actorId: ctx?.actor?.userId,
    ...data,
  }
  const line = JSON.stringify(entry, (_k, v: unknown) =>
    v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v,
  )
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => write('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => write('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => write('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => write('error', message, data),
}
