import { Trans } from 'react-i18next'
import { toast } from 'sonner'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { supportWhatsAppUrl } from '../../shared/support'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { InfoBanner } from '../../shared/ui/info-banner'
import { ModalShell } from '../../shared/ui/modal-shell'
import type { PartnerClient } from './api/home-gateway'
import { clientDate } from './client-date'
import { ClientPaymentMethods } from './client-payment-methods'
import { MockOutline } from '../../shared/ui/mock-outline'

function paymentAmount(currency: string, amount: number | null, locale: string, minimumFractionDigits = 2) {
  return amount === null || !currency ? '—' : `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits, maximumFractionDigits: 2 }).format(amount)}`
}

export function ClientPaymentModal({ client, onClose, returnFocusElement }: { client: PartnerClient; onClose: () => void; returnFocusElement: HTMLElement | null }) {
  const { t, i18n } = useAppTranslation()
  if (client.status !== 'overdue' && client.status !== 'suspended' && client.status !== 'offboarding-pending') return null
  const details = client.paymentDetails
  const status = client.status
  const mockPayment = details?.source === 'mock'
  const currency = details?.currency ?? ''
  const money = (amount: number | null | undefined, min = 2) => paymentAmount(currency, amount ?? null, i18n.language, min)
  const statement = money(details?.statementOwed)
  const balance = money(details?.unpaidBalance)
  const amountToPay = money(details?.amountToPay)
  const suspensionDate = clientDate(details?.suspensionDate ?? null, 'long', i18n.language)
  const closedDate = clientDate(client.closedAt, 'long', i18n.language)
  const balanceAsOf = clientDate(details?.balanceAsOf ?? null, 'long', i18n.language)
  const dueDate = clientDate(details?.dueDate ?? null, 'short', i18n.language)
  const lateFee = details?.monthlyLateFeePercent === null || details?.monthlyLateFeePercent === undefined ? '—' : `${details.monthlyLateFeePercent}%`

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast(t('common.copied'))
    } catch {
      toast.error(t('home.clients.payment.copyError'))
    }
  }

  const notice = <MockOutline enabled={mockPayment}><InfoBanner variant="warning">
    <p className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-normal leading-5">{t(`home.clients.payment.${status}.title`)}</p>
    <p className="mt-1 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5">
      {status === 'suspended'
        ? t('home.clients.payment.suspended.description', { date: suspensionDate, balance })
        : status === 'overdue'
          ? <Trans t={t} i18nKey="home.clients.payment.overdue.descriptionWithMocks" values={{ balance, rate: lateFee, minimum: money(details?.minimumLateFee, 0), date: suspensionDate }} components={{ policy: <MockOutline inline enabled={Boolean(details) && !mockPayment}>{null}</MockOutline>, date: <MockOutline inline enabled={Boolean(details) && !mockPayment}>{null}</MockOutline> }} />
          : t('home.clients.payment.offboarding-pending.description', { date: closedDate, balance, asOf: balanceAsOf })}
    </p>
    <p className={`mt-5 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-5 ${status === 'overdue' ? 'font-medium' : 'font-light'}`}>{t(`home.clients.payment.${status}.instruction`, { amount: amountToPay })}</p>
  </InfoBanner></MockOutline>

  return (
    <ModalShell ariaLabel={client.name ?? client.email ?? client.id} onClose={onClose} returnFocusElement={returnFocusElement} overlayClassName="backdrop-blur-[8px]" panelClassName="max-w-[480px] p-5 font-sans shadow-xs sm:p-[31px]">
      <div className="flex min-w-0 flex-col gap-6">
        <MockOutline enabled={status === 'offboarding-pending'}><div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="surface" size="icon-md" className="size-9 bg-background" onClick={onClose} aria-label={t('common.actions.back')}><img src="/assets/home/arrow-left.svg" alt="" className="size-4 brightness-0 invert" /></Button>
            <h2 className="min-w-0 break-words text-xl font-bold leading-8">{client.name ?? client.email ?? client.id}</h2>
          </div>
          <Badge variant={status === 'suspended' ? 'destructive' : 'warning'} className={status === 'offboarding-pending' ? 'h-auto min-h-6 max-w-[52%] text-center whitespace-normal' : undefined}>{t(`home.clients.status.${status}`)}</Badge>
        </div></MockOutline>

        {status === 'offboarding-pending' ? notice : null}

        <MockOutline enabled={mockPayment}><div className="border border-border px-4 py-2 text-sm font-light leading-6">
          <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border"><span>{t('home.clients.payment.statementOwed')}</span><span className="text-right text-secondary">{statement}</span></div>
          <MockOutline enabled={Boolean(details) && !mockPayment}><div className="flex min-h-10 items-center justify-between gap-3"><span>{t('home.clients.payment.dueDate')}</span><span className="text-right text-secondary">{dueDate}</span></div></MockOutline>
        </div></MockOutline>

        {status === 'offboarding-pending' ? null : notice}

        <ClientPaymentMethods details={details} copy={copy} />

        <InfoBanner variant="warning">
          <p className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-normal leading-5">{t('home.clients.payment.proofTitle')}</p>
          <p className="mt-1 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5">{t('home.clients.payment.proofDescription')}</p>
        </InfoBanner>

        <section className="flex min-w-0 flex-col gap-4 py-2" aria-label={t('home.clients.payment.email')}>
          <h3 className="text-xs font-light leading-5 tracking-[1.6px] text-secondary uppercase">{t('home.clients.payment.email')}</h3>
          <MockOutline enabled={details?.proofEmail !== null && details?.proofEmail !== undefined}><div className="flex min-w-0 items-center gap-2 border border-border px-4 py-3">
            <span className="min-w-0 flex-1 break-all font-[Menlo,monospace] text-xs leading-[18px]">{details?.proofEmail ?? '—'}</span>
            <Button variant="surface" size="compact" textStyle="body" className="h-6 w-12 px-2.5 font-[family-name:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-[8px] leading-5 text-secondary" disabled={!details?.proofEmail} onClick={() => details?.proofEmail && void copy(details.proofEmail)} aria-label={t('home.clients.payment.copyValue', { label: t('home.clients.payment.email') })}>{t('common.actions.copy')}</Button>
          </div></MockOutline>
        </section>

        {status === 'offboarding-pending' ? <div className="flex flex-col gap-2">
          <Button asChild textStyle="strong" className="h-9 w-full"><a href={supportWhatsAppUrl} target="_blank" rel="noopener noreferrer">{t('home.clients.payment.offboarding-pending.contactTeam')}</a></Button>
          <Button variant="surface" textStyle="strong" className="h-9 w-full" onClick={onClose}>{t('common.actions.close')}</Button>
        </div> : <Button textStyle="strong" className="h-9 w-full" onClick={onClose}>{t('common.actions.close')}</Button>}
      </div>
    </ModalShell>
  )
}
