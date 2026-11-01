import { Resend } from 'resend'
import { logger } from '@/server/lib/logger'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  /** Provider-side dedupe; the same key is never delivered twice. */
  idempotencyKey?: string
}

export interface EmailResult {
  provider: 'resend' | 'log'
  messageId: string | null
}

let client: Resend | null | undefined

function resend(): Resend | null {
  if (client !== undefined) return client
  client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  return client
}

/**
 * Sends through Resend when RESEND_API_KEY is set; otherwise logs the message (development and
 * test mode). Throws on provider errors so the notification outbox can retry.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = resend()
  if (!provider) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured: set RESEND_API_KEY and EMAIL_FROM')
    }
    logger.info('email.log_adapter', {
      to: message.to,
      subject: message.subject,
      text: message.text,
    })
    return { provider: 'log', messageId: null }
  }

  const from = process.env.EMAIL_FROM
  if (!from) throw new Error('EMAIL_FROM is not set')

  const { data, error } = await provider.emails.send(
    { from, to: message.to, subject: message.subject, html: message.html, text: message.text },
    message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
  )
  if (error) throw new Error(`Resend: ${error.message}`)
  return { provider: 'resend', messageId: data?.id ?? null }
}
