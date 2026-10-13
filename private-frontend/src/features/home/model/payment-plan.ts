import type { Transaction } from './transaction'
import { appI18n } from '../../../shared/i18n/app-i18n'

export const PAYMENT_PLAN_TERMS = [3, 6, 9] as const
export type PaymentPlanTerm = (typeof PAYMENT_PLAN_TERMS)[number]
export const PAYMENT_PLAN_APR_BASIS_POINTS = 1800

export interface PaymentPlanQuote {
  termMonths: PaymentPlanTerm
  aprBasisPoints: number
  principalCents: number
  feeCents: number
  totalRepayableCents: number
  monthlyPaymentCents: number
}

export interface PaymentPlan extends PaymentPlanQuote {
  id: string
  transactionId: string
  merchant: string
  currency: string
  paidInstallments: number
  startedAt: string
}

export interface StartPaymentPlanInput {
  transactionId: string
  merchant: string
  currency: string
  principalCents: number
  termMonths: PaymentPlanTerm
}

export function quotePaymentPlan(
  principalCents: number,
  termMonths: PaymentPlanTerm,
): PaymentPlanQuote {
  const feeCents = Math.round(
    (principalCents * PAYMENT_PLAN_APR_BASIS_POINTS * termMonths) / 12 / 10_000,
  )
  const totalRepayableCents = principalCents + feeCents
  return {
    termMonths,
    aprBasisPoints: PAYMENT_PLAN_APR_BASIS_POINTS,
    principalCents,
    feeCents,
    totalRepayableCents,
    monthlyPaymentCents: Math.round(totalRepayableCents / termMonths),
  }
}

export function isPayOverTimeEligible(
  transaction: Pick<Transaction, 'type' | 'currency' | 'amountCents' | 'state'>,
  hasActivePlan: boolean,
): boolean {
  return (
    transaction.type === 'card' &&
    transaction.currency === 'USD' &&
    transaction.amountCents > 100_000 &&
    (transaction.state === 'completed' || transaction.state === 'pending') &&
    !hasActivePlan
  )
}

export function formatUsd(amountCents: number, displayLanguage?: string): string {
  const language = displayLanguage ?? appI18n.resolvedLanguage
  const locale = language === 'en' ? 'en-US' : language
  return `USD ${(amountCents / 100).toLocaleString(
    locale ?? 'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`
}

export function formatPaymentPlanStartDate(startedAt: string): string {
  const locale = appI18n.resolvedLanguage === 'en' ? 'en-GB' : appI18n.resolvedLanguage
  return new Date(startedAt).toLocaleDateString(
    locale ?? 'en-GB',
    {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    },
  )
}

export function getRemainingBalanceCents(plan: PaymentPlan): number {
  return Math.max(0, plan.totalRepayableCents - plan.paidInstallments * plan.monthlyPaymentCents)
}

export function getPaymentPlanProgressPercent(
  plan: Pick<PaymentPlan, 'paidInstallments' | 'termMonths'>,
): number {
  return Math.min(100, Math.max(0, (plan.paidInstallments / plan.termMonths) * 100))
}

export function getStatementReductionCents(
  quote: Pick<PaymentPlanQuote, 'principalCents' | 'monthlyPaymentCents'>,
): number {
  return quote.principalCents - quote.monthlyPaymentCents
}
