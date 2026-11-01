/**
 * Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). Accepts spaces, dashes, a leading 0,
 * 91 or +91. Returns null when it is not a valid Indian mobile (starts 6–9, 10 digits).
 * Other countries pass through if already in +E.164 form.
 */
export function normalisePhone(input: string): string | null {
  const raw = input.trim()
  if (/^\+(?!91)\d{8,15}$/.test(raw.replace(/[\s-]/g, ''))) return raw.replace(/[\s-]/g, '')
  const digits = raw.replace(/\D/g, '').replace(/^(?:0|91)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null
}

/** "+919820000001" → "+91 98200 00001" */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164)
  return m ? `+91 ${m[1]} ${m[2]}` : e164
}
