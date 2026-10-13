import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { cn } from '../../shared/cn'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { Skeleton } from '../../shared/ui/skeleton'
import type { AuthenticatorSetup } from './api/auth-gateway'

function AuthenticatorQr({ uri }: { uri: string }) {
  const { t } = useAppTranslation()
  const [qr, setQr] = useState<{ uri: string; dataUrl: string | null } | null>(null)
  useEffect(() => {
    let active = true
    void QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 0, width: 172, color: { light: '#fafafa', dark: '#000000' } }).then((dataUrl) => {
      if (active) setQr({ uri, dataUrl })
    }).catch(() => {
      if (active) setQr({ uri, dataUrl: null })
    })
    return () => { active = false }
  }, [uri])
  const result = qr?.uri === uri ? qr : null
  return <div className="mx-auto flex aspect-square w-[196px] max-w-full items-center justify-center" aria-busy={result === null}>
    {result?.dataUrl ? <div className="rounded bg-foreground p-3"><img src={result.dataUrl} alt={t('auth.authenticator.qr')} width={172} height={172} className="max-w-full" /></div>
      : result ? <p role="status" className="text-center text-xs leading-5 text-secondary">{t('auth.authenticator.qrUnavailable')}</p>
      : <Skeleton className="size-full" />}
  </div>
}

export function AuthenticatorSetupControls({ result, pending, retry }: { result: GatewayResult<AuthenticatorSetup> | null; pending: boolean; retry(): void }) {
  const { t } = useAppTranslation()
  const [manualKey, setManualKey] = useState(false)
  const data = result?.ok ? result.data : null
  const buttonClass = cn('group w-full px-2.5 max-sm:min-h-9 max-sm:whitespace-normal', result === null && 'motion-safe:animate-pulse')
  const buttonContent = <><img src="/assets/auth/authenticator.svg" alt="" width={12} height={12} className="size-3 shrink-0 invert group-hover:invert-0 group-active:invert-0" />{t('auth.authenticator.open')}</>

  async function copyKey() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.secret)
      setManualKey(false)
      toast(t('common.copied'))
    } catch {
      setManualKey(true)
      toast.error(t('auth.authenticator.copyError'))
    }
  }

  if (result && !result.ok) return <div className="flex min-w-0 flex-col gap-2">
    <Button variant="outline" disabled={pending} onClick={retry}>{t('common.actions.retry')}</Button>
  </div>

  return <>
    <div className="flex min-w-0 flex-col gap-2">
      {data && !pending ? <Button asChild variant="outline" withIcon className={buttonClass}><a href={data.uri}>{buttonContent}</a></Button>
        : <Button variant="outline" withIcon className={buttonClass} disabled>{buttonContent}</Button>}
      <p className="text-center text-xs leading-5 tracking-[0.4px] text-muted-foreground">{t('auth.authenticator.hint')}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-4">
      <Button variant="outline" withIcon className={buttonClass} disabled={pending || !data} onClick={() => void copyKey()}>
        <img src="/assets/auth/copy.svg" alt="" width={12} height={12} className="size-3 shrink-0 invert group-hover:invert-0 group-active:invert-0" />{t('auth.authenticator.copyKey')}
      </Button>
      {manualKey && data ? <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs leading-5 tracking-[1.6px] text-secondary uppercase">{t('auth.authenticator.setupKey')}</p>
        <code className="min-w-0 break-all border border-border px-3 py-2 text-xs leading-5 select-all">{data.secret}</code>
      </div> : null}
      <details className="group min-w-0">
        <summary onClick={(event) => { if (event.detail > 0) event.currentTarget.blur() }} className="flex cursor-pointer list-none items-center justify-center gap-1 text-center font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-3 font-light tracking-[1.6px] text-secondary uppercase outline-none select-none group-open:text-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">{t('auth.authenticator.showQr')}</span>
          <img src="/assets/auth/caret-down.svg" alt="" width={12} height={12} className="shrink-0 group-open:hidden" />
          <img src="/assets/auth/caret-up.svg" alt="" width={12} height={12} className="hidden shrink-0 brightness-0 invert group-open:block" />
        </summary>
        <div className="pt-4">
          <div className="flex min-w-0 justify-center py-4">
            {data ? <AuthenticatorQr uri={data.uri} /> : <Skeleton className="aspect-square w-[196px] max-w-full" />}
          </div>
        </div>
      </details>
    </div>
  </>
}
