import { useEffect, useId, useState } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { Skeleton } from '../../shared/ui/skeleton'
import type { ClientPaymentDetails } from './api/home-gateway'
import { MockOutline } from '../../shared/ui/mock-outline'
import { createPaymentQrCode } from './payment-qr-code'

const methods = ['USD', 'EUR', 'Crypto'] as const

function CryptoPaymentQr({ address }: { address: string }) {
  const { t } = useAppTranslation()
  const [qrCode, setQrCode] = useState<{ address: string; dataUrl: string | null } | null>(null)
  useEffect(() => {
    let active = true
    void createPaymentQrCode(address).then((dataUrl) => {
      if (active) setQrCode({ address, dataUrl })
    }).catch(() => {
      if (active) setQrCode({ address, dataUrl: null })
    })
    return () => { active = false }
  }, [address])
  const result = qrCode?.address === address ? qrCode : null
  return <div className="mx-auto flex size-[196px] shrink-0 items-center justify-center" aria-busy={result === null}>
    {result?.dataUrl ? <div className="rounded bg-foreground p-3"><img src={result.dataUrl} alt={t('home.clients.payment.depositQr')} width={172} height={172} /></div>
      : result ? <p role="status" className="text-center text-xs leading-5 text-secondary">{t('home.clients.payment.qrUnavailable')}</p>
      : <Skeleton className="size-full" />}
  </div>
}

function PaymentRow({ label, value, copy }: { label: string; value: string | null; copy: (value: string) => void }) {
  const { t } = useAppTranslation()
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-border py-2.5 last:border-b-0">
      <span className="w-[76px] shrink-0 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5 text-secondary">{label}</span>
      <span className="min-w-0 flex-1 break-all text-center font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5">{value?.trim() ? value : '—'}</span>
      <Button variant="surface" size="compact" textStyle="body" className="h-6 w-12 px-2.5 font-[family-name:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-[8px] leading-5 text-secondary" disabled={!value?.trim()} onClick={() => { if (value?.trim()) copy(value) }} aria-label={t('home.clients.payment.copyValue', { label })}>{t('common.actions.copy')}</Button>
    </div>
  )
}

export function ClientPaymentMethods({ details, copy }: { details: ClientPaymentDetails | null; copy: (value: string) => void }) {
  const { t, i18n } = useAppTranslation()
  const id = useId()
  const [method, setMethod] = useState<typeof methods[number]>(() => details?.bankRails.some(rail => rail.currency === 'USD') ? 'USD' : details?.bankRails.some(rail => rail.currency === 'EUR') ? 'EUR' : details?.crypto ? 'Crypto' : 'USD')
  const rails = details?.bankRails.filter(rail => rail.currency === method) ?? []
  const selectedRail = rails.find(rail => rail.type === 'swift') ?? rails.find(rail => rail.type === 'wire') ?? rails[0]
  const hasMethods = Boolean(details?.eur || details?.crypto)
  const eur = details?.eur
  const crypto = details?.crypto
  const mockBank = details?.source === 'mock'

  return <>
    {details?.source === 'api' && details.bankRails.length === 0 && hasMethods ? <p role="status" className="text-xs leading-5 text-secondary">{t('home.clients.payment.bankUnavailable')}</p> : null}
    {hasMethods ? <section className="flex min-w-0 flex-col gap-4 py-2" aria-label={t('home.clients.payment.paymentMethod')}>
      <h3 className="text-xs font-light leading-5 tracking-[1.6px] text-secondary uppercase">{t('home.clients.payment.paymentMethod')}</h3>
      <div className="flex min-w-0 gap-2" role="tablist" aria-label={t('home.clients.payment.paymentMethod')} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
        const index = tabs.findIndex((tab) => tab === event.target)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        tabs[next]?.focus()
        tabs[next]?.click()
      }}>
        {methods.map((value) => <Button key={value} id={`${id}-${value}`} role="tab" aria-selected={method === value} aria-controls={`${id}-panel`} tabIndex={method === value ? 0 : -1} disabled={value === 'Crypto' ? !crypto : !details?.bankRails.some(rail => rail.currency === value)} variant={method === value ? 'default' : 'outline'} size="chip" textStyle="body" className={`h-8 min-w-0 flex-1 py-0 font-[family-name:'Helvetica_Neue',Helvetica,Arial,sans-serif] ${method !== value ? 'text-secondary' : ''}`} onClick={() => setMethod(value)}>{value === 'Crypto' ? <span className="inline-flex items-center gap-1">{t('home.clients.payment.crypto')}<span className="font-mono text-[8px] text-[#ff4bb8]">MOCK</span></span> : value}</Button>)}
      </div>
    </section> : null}

    <div id={`${id}-panel`} role={hasMethods ? 'tabpanel' : undefined} aria-labelledby={hasMethods ? `${id}-${method}` : undefined} className="flex min-w-0 flex-col gap-6">
      {method === 'EUR' && eur ? <MockOutline enabled={mockBank}><section className="flex min-w-0 flex-col gap-2" aria-label={t('home.clients.payment.eurRates')}>
        <h3 className="text-xs font-light leading-5 tracking-[1.6px] text-secondary uppercase">{t('home.clients.payment.eurRates')}</h3>
        <div className="border border-border px-4 py-2 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5">
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border py-2.5"><span className="text-secondary">{t('home.clients.payment.fxRate')}</span><span className="text-right">{eur.usdRate === null ? '—' : `1 USD = ${new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(eur.usdRate)} EUR`}</span></div>
          <div className="flex min-w-0 items-center justify-between gap-2 py-2.5"><span className="text-secondary">{t('home.clients.payment.statementInEur')}</span><span className="text-right">{eur.statementOwed === null ? '—' : `EUR ${new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(eur.statementOwed)}`}</span></div>
        </div>
      </section></MockOutline> : null}

      {method === 'Crypto' && crypto ? <MockOutline enabled><div className="flex min-w-0 flex-col gap-6">
        <p className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5 text-secondary">{t('home.clients.payment.cryptoDescription')}</p>
        <CryptoPaymentQr address={crypto.depositAddress} />
      </div></MockOutline> : null}

      <MockOutline enabled={method === 'Crypto' ? Boolean(crypto) : mockBank}><section className="flex min-w-0 flex-col gap-4 py-2" aria-label={t('home.clients.payment.transferTo')}>
        <h3 className="text-xs font-light leading-5 tracking-[1.6px] text-secondary uppercase">{t('home.clients.payment.transferTo')}</h3>
        {method === 'Crypto' && crypto ? <div className="flex min-w-0 items-center gap-2 border border-border px-4 py-3">
          <span className="min-w-0 flex-1 break-all font-[Menlo,monospace] text-xs leading-[18px]">{crypto.depositAddress}</span>
          <Button variant="surface" size="compact" textStyle="body" className="h-6 w-12 px-2.5 font-[family-name:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-[8px] leading-5 text-secondary" onClick={() => copy(crypto.depositAddress)} aria-label={t('home.clients.payment.copyValue', { label: t('home.clients.payment.depositAddress') })}>{t('common.actions.copy')}</Button>
        </div> : selectedRail ? <div className="border border-border px-4 py-2">
          {selectedRail.fields.map(field => <PaymentRow key={field.name} label={t(`home.clients.payment.${field.name}`)} value={field.value} copy={copy} />)}
          {selectedRail.thirdPartyAllowed === false ? <p className="pt-2 text-xs leading-5 text-warning">{t('home.clients.payment.thirdPartyUnavailable')}</p> : null}
        </div> : <p role="status" className="text-xs leading-5 text-secondary">{t('home.clients.payment.bankUnavailable')}</p>}

      </section></MockOutline>
    </div>
  </>
}
