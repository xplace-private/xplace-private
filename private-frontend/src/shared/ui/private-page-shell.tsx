import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '../cn'
import { useAppTranslation } from '../i18n/app-i18n'
import { LanguageMenu } from '../i18n/language-menu'
import { Button } from './button'
import { TokenIcon } from './token-icon'

interface PrivatePageShellProps {
  children: ReactNode
  fillContent?: boolean
}

const DEFAULT_LOGO_URL = '/assets/auth/xplace-logo.svg'

function readThemeLogoUrl(): string | null {
  return typeof document === 'undefined'
    ? DEFAULT_LOGO_URL
    : document.documentElement.dataset.logoUrl === undefined
      ? DEFAULT_LOGO_URL
      : document.documentElement.dataset.logoUrl || null
}

/** Shared XPlace Private navigation, page frame, and legal footer. */
export function PrivatePageShell({
  children,
  fillContent = true,
}: PrivatePageShellProps) {
  const { t } = useAppTranslation()
  const [logoUrl, setLogoUrl] = useState(readThemeLogoUrl)

  useEffect(() => {
    const updateLogo = () => setLogoUrl(readThemeLogoUrl())
    window.addEventListener('themechange', updateLogo)
    return () => window.removeEventListener('themechange', updateLogo)
  }, [])

  return (
    <main className="relative min-h-dvh min-w-0 bg-background text-foreground">
      <div className="relative min-h-dvh w-full min-w-0 bg-background">
        <header
          className="fixed inset-x-0 top-0 z-30 h-[calc(65px+env(safe-area-inset-top,0px))] w-full border-b border-border bg-header pt-[env(safe-area-inset-top,0px)] backdrop-blur-[14px]"
          data-theme-header
        >
          <div className="mx-auto flex h-full w-full min-w-0 items-center justify-between gap-2 px-3 min-[360px]:gap-3 min-[360px]:px-4 min-[480px]:max-w-[1000px] min-[480px]:px-[26px]">
            <div className="flex min-w-0 shrink items-center gap-2 min-[360px]:gap-[11px]">
              {logoUrl === null ? null : (
                <img
                  className="h-auto max-h-[22px] w-auto max-w-[141px] shrink-0"
                  src={logoUrl}
                  alt="XPlace"
                />
              )}
              <span
                className="truncate border-l border-secondary pl-2 text-xs leading-none font-light tracking-[2.6px] text-secondary min-[360px]:pl-[11px]"
                data-private-header-label
              >
                PRIVATE
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 min-[360px]:gap-3">
              <LanguageMenu />
              <Button
                className="min-[561px]:px-2.5 min-[561px]:py-[7px] text-xs leading-5 transition-colors"
                variant="outline"
                withIcon
                size="icon-md"
                textStyle="regular"
                aria-label={t('shell.openWhatsApp')}
                asChild
              >
                <a href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer">
                  <TokenIcon className="size-4" src="/assets/auth/whatsapp-outline.svg" />
                  <span className="hidden min-[561px]:inline">{t('shell.concierge')}</span>
                </a>
              </Button>
            </div>
          </div>
        </header>
        <div
          className="h-[calc(65px+env(safe-area-inset-top,0px))] shrink-0"
          aria-hidden="true"
        />

        <div className="flex min-h-[calc(100dvh-65px-env(safe-area-inset-top,0px))] min-w-0 flex-col">
          <div className={cn('mx-auto flex min-w-0 flex-1 flex-col w-full min-[480px]:max-w-[460px] min-[480px]:px-[10px]', !fillContent && 'flex-none')}>
            {children}
          </div>
          <footer className="w-full min-w-0 border-t border-border">
            <div className="mx-auto flex w-full min-w-0 flex-col gap-[18.905px] px-4 pt-[21.2px] pb-[max(24px,env(safe-area-inset-bottom,0px))] min-[480px]:max-w-[1000px] min-[480px]:px-[26px]">
              <div className="flex h-[21.59px] items-start gap-[22px] text-xs leading-[21.6px] font-light text-secondary">
                <span>{t('shell.agreement')}</span>
                <span>{t('shell.privacy')}</span>
              </div>
              <p className="text-[11px] leading-[19.8px] font-light text-secondary">
                Pontech Group L.L.C-FZ, Meydan Free Zone, Dubai. XPlace is a financial technology
                company and is not a bank. Cards are issued by our licensed issuing partner
                pursuant to a licence from Visa.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
