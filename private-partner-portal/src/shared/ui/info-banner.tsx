import type { ReactNode } from 'react'

type InfoBannerVariant = 'neutral' | 'warning'

interface InfoBannerProps {
  children: ReactNode
  variant: InfoBannerVariant
}

const variantClasses: Record<InfoBannerVariant, string> = {
  neutral:
    'flex flex-col gap-1 border-l-2 border-border bg-card px-4 pt-[14.2px] pb-[14.285px] text-xs leading-[19.2px]',
  warning:
    'border-l-2 border-notice-accent bg-notice-background px-[17px] pt-[16.2px] pb-[15.62px] text-[13px] leading-[20.8px] font-light text-notice-accent',
}

/** Shared informational surface with neutral and warning treatments. */
export function InfoBanner({ children, variant }: InfoBannerProps) {
  return <aside className={variantClasses[variant]}>{children}</aside>
}
