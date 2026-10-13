import { useAppTranslation } from '../i18n/app-i18n'

interface LoaderProps {
  decorative?: boolean
  label?: string
  tone?: 'dark' | 'light'
}

/** Figma loader asset with reduced-motion support. */
export function Loader({
  decorative = false,
  label,
  tone = 'dark',
}: LoaderProps) {
  const { t } = useAppTranslation()

  return (
    <span
      className={`relative size-4 animate-spin motion-reduce:animate-none ${
        tone === 'light' ? 'text-primary' : 'text-primary-foreground'
      }`}
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative || undefined}
    >
      {!decorative && (
        <span className="sr-only">{label ?? t('common.loading')}</span>
      )}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        {tone === 'dark' ? (
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="2"
          />
        ) : null}
        <path
          d="M15 8C15 8.91925 14.8189 9.8295 14.4672 10.6788C14.1154 11.5281 13.5998 12.2997 12.9497 12.9497C12.2997 13.5998 11.5281 14.1154 10.6788 14.4672C9.82951 14.8189 8.91925 15 8 15"
          stroke="currentColor"
          strokeOpacity={tone === 'dark' ? '0.9' : undefined}
          strokeWidth="2"
        />
      </svg>
    </span>
  )
}
