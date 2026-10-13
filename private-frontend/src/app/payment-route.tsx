import { useRouter } from '@tanstack/react-router'

import {
  formatUsd,
  getStatementReductionCents,
} from '../features/home/model/payment-plan'
import { usePaymentPlans } from '../features/home/payment-plans-provider'
import { usePrivateBalance } from '../features/home/private-balance-query'
import { useDeposits } from '../features/payment/deposits-query'
import { useEurDebt } from '../features/payment/eur-debt-query'
import { PaymentScreen } from '../features/payment/payment-screen'
import { formatShortDate } from '../shared/format-short-date'
import { useAppTranslation } from '../shared/i18n/app-i18n'
import { appRuntime } from './app-runtime'
import { returnToHome } from './navigation'

/** Maps app-owned plan state into the Payment feature's presentation contract. */
export function PaymentRoute() {
  const { i18n, t } = useAppTranslation()
  const router = useRouter()
  const deposits = useDeposits(appRuntime.depositsGateway)
  const balanceQuery = usePrivateBalance(appRuntime.privateBalanceGateway, true)
  const balance = balanceQuery.data
  const eurDebt = useEurDebt(appRuntime.eurDebtGateway)
  const { state: paymentPlansState } = usePaymentPlans()
  const language = i18n.resolvedLanguage ?? 'en'
  const unavailable = t('common.notAvailable')
  const amountCents = balance?.dueThisPeriodCents ?? null
  const statement = {
    balance: amountCents === null
      ? unavailable
      : formatUsd(amountCents, language),
    amountCents,
    loading: balanceQuery.isPending || eurDebt.state.status === 'loading',
    dateLoading: balanceQuery.isPending,
    statementDate: balance?.dueDate === null || balance?.dueDate === undefined
      ? unavailable
      : formatShortDate(balance.dueDate, language),
  }
  const planAdjustments = paymentPlansState.plans.map((plan) => {
    const reductionCents = getStatementReductionCents(plan)

    return {
      id: plan.id,
      merchant: plan.merchant,
      originalAmount: formatUsd(plan.principalCents),
      monthlyPayment: t('home.paymentPlans.monthly', {
        amount: formatUsd(plan.monthlyPaymentCents),
      }),
      termLabel: t('home.paymentPlans.months', { count: plan.termMonths }),
      reductionCents,
      reduction: `−${formatUsd(reductionCents)}`,
    }
  })

  return (
    <PaymentScreen
      details={{ statement }}
      bankDeposits={deposits.bank}
      eurDeposits={deposits.eur}
      cryptoDeposits={deposits.crypto}
      eurDebt={eurDebt.state}
      planAdjustments={planAdjustments}
      onBack={() => returnToHome(router.history)}
    />
  )
}
