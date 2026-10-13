import { useEffect, useState } from 'react'

import { copyToClipboard } from '../../shared/copy-to-clipboard'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { InfoBanner } from '../../shared/ui/info-banner'
import { Skeleton } from '../../shared/ui/skeleton'
import { TokenIcon } from '../../shared/ui/token-icon'
import { isDepositReady, type BankInstructions, type CryptoInstructions } from './api/deposits-gateway'
import type { BankDepositsState, CryptoDepositsState } from './deposits-query'
import type { EurDebtState } from './eur-debt-query'
import type { PaymentDetails } from './payment-data'
import { createPaymentQrCode } from './payment-services'
import {
  StatementPlanDisclosure,
  type StatementPlanAdjustment,
} from './statement-plan-disclosure'

type PaymentMethod = 'usd' | 'eur' | 'usdc'

function PaymentLabel({ children }: { children: string }) {
  return (
    <p className="font-sans text-xs leading-5 font-light tracking-[1.6px] text-secondary uppercase">
      {children}
    </p>
  )
}

function CopyButton({ onClick, disabled = false, loading = false }: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const { t } = useAppTranslation()

  const button = (
    <Button
      className="shrink-0 text-secondary"
      variant="outline"
      size="compact"
      textStyle="body"
      disabled={disabled || loading}
      aria-label={t('payment.copyDetail')}
      onClick={onClick}
    >
      {t('common.actions.copy')}
    </Button>
  )
  return loading ? (
    <div className="relative" aria-hidden="true">
      <div className="invisible flex">{button}</div>
      <Skeleton className="absolute inset-0" />
    </div>
  ) : button
}

interface PaymentMethodTabsProps {
  activeMethod: PaymentMethod
  availableMethods: readonly PaymentMethod[]
  onSelect: (method: PaymentMethod) => void
}

/** Payment currencies whose deposit channels are ready to use. */
export function PaymentMethodTabs({ activeMethod, availableMethods, onSelect }: PaymentMethodTabsProps) {
  const { t } = useAppTranslation()

  return (
    <div className="flex min-w-0 gap-2" aria-label={t('payment.method')}>
      {(
        [
          ['usd', 'USD'],
          ['eur', 'EUR'],
          ['usdc', 'USDC'],
        ] as const
      ).filter(([method]) => availableMethods.includes(method)).map(([method, label]) => {
        const isActive = method === activeMethod

        return (
          <Button
            className={isActive
              ? 'flex-1 shadow-none'
              : 'flex-1 text-secondary shadow-none'}
            variant={isActive ? 'default' : 'outline'}
            size="chip"
            textStyle="body"
            aria-pressed={isActive}
            key={method}
            onClick={() => onSelect(method)}
          >
            <span className="min-w-0 truncate">{label}</span>
          </Button>
        )
      })}
    </div>
  )
}

function PaymentSummary({
  statement,
  planAdjustments,
}: Pick<PaymentDetails, 'statement'> & {
  planAdjustments: readonly StatementPlanAdjustment[]
}) {
  const { t } = useAppTranslation()
  const [plansExpanded, setPlansExpanded] = useState(true)

  return (
    <section className="flex min-w-0 flex-col border border-border bg-card px-4 py-2 font-sans text-sm leading-6 font-light">
      <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border py-2">
        <span>{t('payment.statementBalance')}</span>
        {statement.loading
          ? <Skeleton className="h-5 w-24" />
          : <span className="shrink-0 text-secondary">{statement.balance}</span>}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-4 py-2">
        <span>{t('payment.statementDate')}</span>
        {(statement.dateLoading ?? statement.loading)
          ? <Skeleton className="h-5 w-16" />
          : <span className="shrink-0 text-secondary">{statement.statementDate}</span>}
      </div>
      <StatementPlanDisclosure
        adjustments={planAdjustments}
        expanded={plansExpanded}
        onToggle={() => setPlansExpanded((expanded) => !expanded)}
      />
    </section>
  )
}

function formatAmount(cents: number, language: string) {
  return (cents / 100).toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PaymentRates({ currency, statement, eurDebt }: {
  currency: 'eur' | 'usdc'
  statement: PaymentDetails['statement']
  eurDebt: EurDebtState
}) {
  const { i18n, t } = useAppTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const quote = eurDebt.status === 'ready' ? eurDebt.quote : null
  const amountCents = currency === 'eur' ? quote?.amountEurCents : statement.amountCents
  if (amountCents === null || amountCents === undefined || (currency === 'usdc' && statement.loading)) return null
  const rate = currency === 'eur' && quote !== null
    ? `1 USD = ${Number(quote.fxRate).toLocaleString(language, { maximumFractionDigits: 4 })} EUR`
    : '1 USDC = 1 USD'
  const amount = currency === 'eur'
    ? `EUR ${formatAmount(amountCents, language)}`
    : `${formatAmount(amountCents, language)} USDC`
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <PaymentLabel>{t('payment.rates', { currency: currency.toUpperCase() })}</PaymentLabel>
      <div className="flex min-w-0 flex-col border border-border bg-card px-4 py-2 text-xs leading-5 font-light">
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border py-2.5">
          <span className="text-secondary">{t('payment.fxRate')}</span>
          <span className="min-w-0 text-right">{rate}</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4 py-2.5">
          <span className="text-secondary">{t('payment.statementIn', { currency: currency.toUpperCase() })}</span>
          <span className="min-w-0 text-right">{amount}</span>
        </div>
      </div>
    </section>
  )
}

function BankPaymentDetails({
  instructions,
  currency,
  onCopy,
}: {
  instructions: BankInstructions | undefined
  currency: string | null | undefined
  onCopy: (value: string) => void
}) {
  const { t } = useAppTranslation()
  const loading = instructions === undefined
  const ibanDetails = instructions?.paymentRail === 'swift' || instructions?.paymentRail === 'sepa'
    ? instructions : undefined
  const details = ibanDetails || (loading && currency === 'eur')
    ? [
        { label: t('payment.beneficiaryName'), value: ibanDetails?.beneficiaryName },
        { label: t('payment.bank'), value: ibanDetails?.bankName },
        { label: t('payment.iban'), value: ibanDetails?.iban },
        { label: t('payment.swift'), value: ibanDetails?.bic },
        { label: t('payment.reference'), value: ibanDetails?.reference },
        { label: t('payment.beneficiaryAddress'), value: ibanDetails?.beneficiaryAddress },
        { label: t('payment.bankAddress'), value: ibanDetails?.bankAddress },
        ...(ibanDetails?.paymentRail === 'swift'
          ? [{ label: t('payment.accountNumber'), value: ibanDetails.accountNumber }] : []),
        { label: t('payment.currency'), value: currency?.toUpperCase() },
      ]
    : [
        { label: t('payment.beneficiaryName'), value: instructions?.beneficiaryName },
        { label: t('payment.beneficiaryAddress'), value: instructions?.beneficiaryAddress },
        { label: t('payment.bank'), value: instructions?.bankName },
        { label: t('payment.bankAddress'), value: instructions?.bankAddress },
        { label: t('payment.accountNumber'), value: instructions && 'accountNumber' in instructions ? instructions.accountNumber : undefined },
        { label: t('payment.routingNumber'), value: instructions && 'routingNumber' in instructions ? instructions.routingNumber : undefined },
        { label: t('payment.currency'), value: currency?.toUpperCase() },
      ]

  return (
    <div className="flex min-w-0 flex-col border border-border bg-card px-4 py-2" data-bank-details>
      {details.filter(({ value }) => loading || (value !== null && value !== undefined)).map(({ label, value }) => (
        <div
          className="grid min-w-0 grid-cols-[minmax(54px,auto)_minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-2.5 last:border-b-0"
          key={label}
          data-bank-row={label}
        >
          <span className="text-xs leading-5 font-light text-secondary">{label}</span>
          <div className="min-w-0 text-right text-xs leading-5 font-light">
            {loading ? <Skeleton className="ml-auto h-[17px] w-full" /> : (
              <span className="break-all">{value?.trim() ? value : '—'}</span>
            )}
          </div>
          <CopyButton loading={loading} disabled={!value?.trim()} onClick={() => { if (value?.trim()) onCopy(value) }} />
        </div>
      ))}
    </div>
  )
}

function BankDeposits({ state, currency, onCopy }: {
  state: BankDepositsState
  currency: 'usd' | 'eur'
  onCopy: (value: string) => void
}) {
  const { t } = useAppTranslation()
  const deposits = state.deposits.filter(isDepositReady)
  const selected = deposits.find((deposit) => deposit.instructions.paymentRail === 'swift')
    ?? deposits.find((deposit) => deposit.instructions.paymentRail === 'wire')
    ?? deposits[0]
  const loading = state.status === 'loading'

  return (
    <>
      <section className="flex min-w-0 flex-col gap-4 py-2" aria-busy={loading}>
        <PaymentLabel>{t(currency === 'eur' ? 'payment.sepaTransferTo' : 'payment.swiftTransferTo')}</PaymentLabel>
        {loading || selected ? (
          <>
            {loading ? <p className="sr-only" role="status">{t('payment.loadingBankDetails')}</p> : null}
            <BankPaymentDetails
              instructions={selected?.instructions}
              currency={loading ? currency : selected?.sourceCurrency}
              onCopy={onCopy}
            />
          </>
        ) : (
          <div role="status">
            <InfoBanner variant="warning">
              <p>{t(state.status === 'timed-out' ? 'payment.detailsWaitExpired' : 'payment.bankUnavailable')}</p>
              <p>{t('payment.contactConcierge')}</p>
            </InfoBanner>
          </div>
        )}
      </section>
      {loading || selected ? (
        <InfoBanner variant="warning">{t('payment.statementNotice')}</InfoBanner>
      ) : null}
    </>
  )
}

interface CryptoPaymentDetailsProps {
  details: CryptoInstructions | null
  qrCodeDataUrl: string | null
  onCopy: (value: string) => void
}

/** Crypto instructions whose address and QR source can come directly from an API response. */
export function CryptoPaymentDetails({
  details,
  qrCodeDataUrl,
  onCopy,
}: CryptoPaymentDetailsProps) {
  const { t } = useAppTranslation()
  const loading = details === null

  return (
    <section className="flex min-w-0 flex-col gap-4 py-2" aria-busy={loading}>
      <p className="text-xs leading-[19.2px] font-light text-secondary">
        {t('payment.cryptoDescription', { asset: 'USDC', network: 'ERC-20' })}
      </p>
      {loading ? <p className="sr-only" role="status">{t('payment.loadingCryptoDetails')}</p> : null}

      <div className="mx-auto flex size-[196px] shrink-0 items-center justify-center" aria-busy={!qrCodeDataUrl} data-crypto-qr>
        {details && qrCodeDataUrl ? (
          <div className="rounded-sm bg-qr-background p-3">
            <img
              className="size-[172px]"
              src={qrCodeDataUrl}
              alt={t('payment.qrAlt', { asset: details.asset })}
            />
          </div>
        ) : <Skeleton className="size-full" />}
      </div>

      <PaymentLabel>{t('payment.cryptoTransferTo')}</PaymentLabel>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-border bg-card px-4 py-[14px]" data-crypto-address>
        {details ? (
          <code className="min-w-0 break-all font-mono text-[11px] leading-[18px] text-foreground">
            {details.address}
          </code>
        ) : (
          <Skeleton className="min-w-0 break-all font-mono text-[11px] leading-[18px]">
            {/* Match the wrapping of a 42-character Ethereum address. */}
            <span className="invisible">{'0'.repeat(42)}</span>
          </Skeleton>
        )}
        <CopyButton loading={loading} onClick={() => { if (details) onCopy(details.address) }} />
      </div>
    </section>
  )
}

export function CryptoDeposits({ state, onCopy }: {
  state: CryptoDepositsState
  onCopy: (value: string) => void
}) {
  const { t } = useAppTranslation()
  const address = state.details?.address
  const [qrCode, setQrCode] = useState<{ address: string; dataUrl: string } | null>(null)

  useEffect(() => {
    if (!address) return
    let active = true
    let generation = 0
    const updateQrCode = () => {
      const currentGeneration = ++generation
      void createPaymentQrCode(address).then((dataUrl) => {
        if (active && currentGeneration === generation) setQrCode({ address, dataUrl })
      }).catch(() => {
        if (active && currentGeneration === generation) setQrCode(null)
      })
    }
    updateQrCode()
    window.addEventListener('themechange', updateQrCode)
    return () => {
      active = false
      window.removeEventListener('themechange', updateQrCode)
    }
  }, [address])

  if (state.status === 'timed-out') {
    return (
      <section className="flex min-w-0 flex-col gap-4 py-2" role="status">
        <PaymentLabel>{t('payment.cryptoTransferTo')}</PaymentLabel>
        <InfoBanner variant="warning">
          <p>{t('payment.detailsWaitExpired')}</p>
          <p>{t('payment.contactConcierge')}</p>
        </InfoBanner>
      </section>
    )
  }

  return (
    <>
      <CryptoPaymentDetails
        details={state.details}
        qrCodeDataUrl={qrCode && qrCode.address === address ? qrCode.dataUrl : null}
        onCopy={onCopy}
      />
      {state.details ? (
        <InfoBanner variant="warning">
          {t('payment.statementNotice')}
        </InfoBanner>
      ) : null}
    </>
  )
}

interface PaymentScreenProps {
  details: PaymentDetails
  bankDeposits: BankDepositsState
  eurDeposits: BankDepositsState
  cryptoDeposits: CryptoDepositsState
  eurDebt?: EurDebtState
  onBack?: () => void
  planAdjustments?: readonly StatementPlanAdjustment[]
}

/** Bank and USDC payment instructions opened from the home balance card. */
export function PaymentScreen({
  details,
  bankDeposits,
  eurDeposits,
  cryptoDeposits,
  eurDebt = { status: 'unavailable' },
  onBack,
  planAdjustments = [],
}: PaymentScreenProps) {
  const { i18n, t } = useAppTranslation()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const availableMethods: PaymentMethod[] = []
  if (bankDeposits.deposits.some(isDepositReady)) availableMethods.push('usd')
  if (eurDeposits.deposits.some(isDepositReady)) availableMethods.push('eur')
  if (cryptoDeposits.status === 'ready' && cryptoDeposits.details !== null) availableMethods.push('usdc')
  const activeMethod = selectedMethod !== null && availableMethods.includes(selectedMethod)
    ? selectedMethod
    : availableMethods[0] ?? 'usd'
  const waitingForFirstAccount = availableMethods.length === 0 &&
    [bankDeposits.status, eurDeposits.status, cryptoDeposits.status].includes('loading')
  const statement = eurDebt.status === 'ready'
    ? {
        ...details.statement,
        balance: `USD ${formatAmount(eurDebt.quote.amountUsdCents, i18n.resolvedLanguage ?? 'en')}`,
        amountCents: eurDebt.quote.amountUsdCents,
        loading: false,
      }
    : details.statement
  const copyValue = (value: string) => {
    void copyToClipboard(value, navigator.clipboard)
  }

  return (
    <div className="flex min-h-[calc(100dvh-65px-env(safe-area-inset-top,0px))] min-w-0 flex-col gap-4 px-4 pt-6 pb-4">
      <div className="flex min-w-0 flex-col gap-4">
        <Button
          className="w-fit text-secondary"
          variant="ghost"
          size="back"
          textStyle="body"
          onClick={onBack}
        >
          <TokenIcon className="size-[13px]" src="/assets/transactions/back.svg" />
          {t('common.actions.account')}
        </Button>
        <h1 className="text-[32px] leading-[1.12] font-bold tracking-[-1.2px]">
          {t('payment.title')}
        </h1>
      </div>

      <PaymentSummary
        statement={statement}
        planAdjustments={planAdjustments}
      />

      <section className="flex min-w-0 flex-col gap-4 py-2" aria-busy={waitingForFirstAccount || undefined}>
        <PaymentLabel>{t('payment.method')}</PaymentLabel>
        {waitingForFirstAccount ? (
          <div className="flex min-w-0 gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
        ) : (
          <PaymentMethodTabs activeMethod={activeMethod} availableMethods={availableMethods} onSelect={setSelectedMethod} />
        )}
      </section>

      {activeMethod !== 'usd' ? (
        <PaymentRates currency={activeMethod} statement={statement} eurDebt={eurDebt} />
      ) : null}

      {activeMethod !== 'usdc' ? (
        <BankDeposits
          state={waitingForFirstAccount ? { status: 'loading', deposits: [] } : activeMethod === 'eur' ? eurDeposits : bankDeposits}
          currency={activeMethod}
          onCopy={copyValue}
        />
      ) : (
        <CryptoDeposits state={cryptoDeposits} onCopy={copyValue} />
      )}

      <div className="py-4">
        <Button variant="outline" size="default" asChild>
          <a href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer">
            {t('home.concierge.message')}
          </a>
        </Button>
      </div>
    </div>
  )
}
