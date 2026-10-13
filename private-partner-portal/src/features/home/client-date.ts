export function clientDate(value: string | null, month: 'short' | 'long', locale: string) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month, timeZone: 'UTC' }).formatToParts(date)
  return `${parts.find((part) => part.type === 'day')?.value} ${parts.find((part) => part.type === 'month')?.value}`
}
