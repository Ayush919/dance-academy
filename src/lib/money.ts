/** Money is stored in minor units (paise). These helpers convert at the edges only. */

export function toMinor(amount: number): number {
  return Math.round(amount * 100)
}

export function fromMinor(minor: number): number {
  return minor / 100
}

export function formatMoney(minor: number, currency = 'INR', locale = 'en-IN'): string {
  const whole = minor % 100 === 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)
}
