import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { copyToClipboard } from '../../../shared/copy-to-clipboard'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { TokenIcon } from '../../../shared/ui/token-icon'
import type { AuthenticatorSetup } from '../api/authenticator-gateway'

function AuthenticatorQr({ uri }: { uri: string }) {
  const { t } = useAppTranslation()
  const [qr, setQr] = useState<{ uri: string; dataUrl: string | null } | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M', margin: 0, width: 172,
      color: { light: '#fafafa', dark: '#000000' },
    }).then((dataUrl) => {
      if (active) setQr({ uri, dataUrl })
    }).catch(() => {
      if (active) setQr({ uri, dataUrl: null })
    })
    return () => { active = false }
  }, [uri])

  const result = qr?.uri === uri ? qr : null
  return (
    <div className="mx-auto flex aspect-square w-[196px] max-w-full items-center justify-center" aria-busy={result === null}>
      {result?.dataUrl ? (
        <div className="rounded bg-qr-background p-3">
          <img src={result.dataUrl} alt={t('auth.authenticator.qr')} width={172} height={172} className="max-w-full" />
        </div>
      ) : result ? (
        <p role="status" className="text-center text-xs leading-5 text-secondary">{t('auth.authenticator.qrUnavailable')}</p>
      ) : <Skeleton className="size-full" />}
    </div>
  )
}

export function AuthenticatorSetupControls({ setup, pending, failed }: { setup: AuthenticatorSetup | null; pending: boolean; failed: boolean }) {
  const { t } = useAppTranslation()
  const [manualKey, setManualKey] = useState(false)
  const buttonClass = 'group w-full px-2.5 whitespace-normal'
  const buttonContent = <><TokenIcon src="/assets/auth/authenticator.svg" className="size-3" />{t('auth.authenticator.open')}</>

  async function copyKey() {
    if (!setup) return
    const copied = await copyToClipboard(setup.secret, navigator.clipboard)
    setManualKey(!copied)
    if (!copied) toast.error(t('auth.authenticator.copyError'))
  }

  return (
    <>
      <ol className="flex min-w-0 flex-col gap-3 font-sans">
        {[1, 2, 3, 4].map((step) => (
          <li key={step} className="flex min-w-0 items-start gap-4 text-muted-foreground">
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center border border-border bg-card text-[8px] leading-4 font-medium">{step}</span>
            <p className="min-w-0 text-xs leading-5 tracking-[0.4px]">{t(`auth.authenticator.step${step}`)}</p>
          </li>
        ))}
      </ol>
      {!failed ? (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            {setup && !pending ? (
              <Button asChild variant="outline" size="nav" withIcon className={buttonClass}>
                <a href={setup.uri}>{buttonContent}</a>
              </Button>
            ) : <Button variant="outline" size="nav" withIcon className={buttonClass} disabled>{buttonContent}</Button>}
            <p className="text-center font-sans text-xs leading-5 tracking-[0.4px] text-muted-foreground">{t('auth.authenticator.hint')}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {setup ? <AuthenticatorQr uri={setup.uri} /> : <Skeleton className="mx-auto aspect-square w-[196px] max-w-full" />}
            <Button variant="outline" size="nav" withIcon className={buttonClass} disabled={pending || !setup} onClick={() => void copyKey()}>
              <TokenIcon src="/assets/auth/copy.svg" className="size-3" />{t('auth.authenticator.copyKey')}
            </Button>
            {manualKey && setup ? (
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-xs leading-5 tracking-[1.6px] text-secondary uppercase">{t('auth.authenticator.setupKey')}</p>
                <code className="min-w-0 break-all border border-border px-3 py-2 text-xs leading-5 select-all">{setup.secret}</code>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  )
}
