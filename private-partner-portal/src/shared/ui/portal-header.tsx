import type { ReactNode } from 'react'

import { useAppTranslation } from '../i18n/app-i18n'
import { Skeleton } from './skeleton'

interface PortalHeaderProps {
  companyName: string | null | undefined
  loading: boolean
  signOut: ReactNode
  onCompanyClick: () => void
  onLogoClick: () => void
}

export function PortalHeader({ companyName, loading, signOut, onCompanyClick, onLogoClick }: PortalHeaderProps) {
  const { t } = useAppTranslation()

  return <header className="flex min-h-[72px] min-w-0 flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4 sm:flex-nowrap sm:px-10 sm:py-0">
    <div className="flex shrink-0 items-center gap-[11px]">
      <button type="button" onClick={onLogoClick} aria-label={t('home.title')} className="outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src="/assets/home/logo.png" alt="XPlace" className="h-[19px] w-[84.22px]" /></button>
      <span className="border-l border-secondary pl-[11px] font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-[14px] font-light tracking-[2.6px] text-secondary">{t('home.portalName')}</span>
    </div>
    <div className="flex min-w-0 items-center gap-6">
      <div className="flex h-5 min-w-0 items-center text-xs leading-5 font-bold tracking-[1.6px] text-secondary uppercase">
        {loading && companyName == null ? <Skeleton className="h-3 w-[162px] max-w-full" /> : <button type="button" onClick={onCompanyClick} className="min-w-0 truncate text-left uppercase outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{companyName ?? t('common.notAvailable')}</button>}
      </div>
      <div className="h-6 shrink-0 border-l border-border" />
      {signOut}
    </div>
  </header>
}
