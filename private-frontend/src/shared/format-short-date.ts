export function formatShortDate(value: string, language: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(
    language === 'en' ? 'en-GB' : language,
    { day: 'numeric', month: 'short', timeZone: 'UTC' },
  )
}
