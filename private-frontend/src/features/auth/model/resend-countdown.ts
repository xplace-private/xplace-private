export const DEFAULT_RESEND_SECONDS = 60

interface ResendDurationUnits {
  hour: string
  minute: string
  second: string
  separator?: string
}

const DEFAULT_UNITS: ResendDurationUnits = {
  hour: 'h',
  minute: 'm',
  second: 's',
}

export function formatResendDuration(
  totalSeconds: number,
  units: ResendDurationUnits = DEFAULT_UNITS,
): string {
  const separator = units.separator ?? ''

  if (totalSeconds <= 60) {
    return `${totalSeconds}${separator}${units.second}`
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}${separator}${units.hour} ${minutes}${separator}${units.minute} ${seconds}${separator}${units.second}`
  }

  return `${minutes}${separator}${units.minute} ${seconds}${separator}${units.second}`
}
