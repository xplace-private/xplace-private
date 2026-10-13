import { useQuery } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { MetricCard } from '../../shared/ui/metric-card'
import { PortalHeader } from '../../shared/ui/portal-header'
import type { HomeGateway } from './api/home-gateway'
import { HomeSessionError } from './api/home-gateway'
import { HomeChart } from './home-chart'
import { HomeClients } from './home-clients'
import { overviewQuery } from './home-queries'

export function HomeScreen({ gateway, signOut, onSessionChanged, onProfile, onHome, knownCompanyName, companyNameLoading }: { gateway: HomeGateway; signOut: ReactNode; onSessionChanged: () => Promise<void>; onProfile: () => void; onHome: () => void; knownCompanyName?: string | null | undefined; companyNameLoading?: boolean }) {
  const { t, i18n } = useAppTranslation()
  const overview = useQuery(overviewQuery(gateway))
  const data = overview.data
  useEffect(() => {
    if (overview.error instanceof HomeSessionError) void onSessionChanged().catch(() => undefined)
  }, [overview.error, onSessionChanged])
  function money(value: number | null | undefined, decimals = 0) {
    return value == null || !data ? '—' : new Intl.NumberFormat(i18n.language, { style: 'currency', currency: data.currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
  }
  const count = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat(i18n.language).format(value)

  return (
    <div className="min-h-dvh min-w-0 font-sans">
      <PortalHeader companyName={knownCompanyName === undefined ? data?.partnerName : knownCompanyName} loading={companyNameLoading ?? overview.isPending} signOut={signOut} onCompanyClick={onProfile} onLogoClick={onHome} />
      <main className="flex min-w-0 flex-col gap-8 px-4 pt-8 pb-[60px] sm:px-10">
        <h1 className="sr-only">{t('home.title')}</h1>
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 min-[87.5rem]:grid-cols-5">
          <MetricCard label={t('home.totalSpend')} value={money(data?.spend)} loading={overview.isPending} valueWidth={198} />
          <MetricCard label={t('home.commission')} value={money(data?.commission)} loading={overview.isPending} valueWidth={164} detailWidth={169} detail={t('home.payout', { value: money(data?.availablePayout) })} />
          <MetricCard label={t('home.purchases')} value={count(data?.purchases)} loading={overview.isPending} valueWidth={63} detailWidth={169} detail={<><span>{t('home.completed', { value: count(data?.completedPurchases) })}</span><span>/</span><span>{t('home.pending', { value: count(data?.pendingPurchases) })}</span></>} />
          <MetricCard label={t('home.averagePurchase')} value={money(data?.averagePurchase, 2)} loading={overview.isPending} valueWidth={144} />
          <MetricCard label={t('home.activeClients')} value={count(data?.activeClients)} loading={overview.isPending} valueWidth={40} detailWidth={151} detail={<><span className="text-warning">{t('home.overdue', { value: count(data?.overdueClients) })}</span><span>/</span><span className="text-destructive">{t('home.suspended', { value: count(data?.suspendedClients) })}</span></>} />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          {(['spend', 'commission'] as const).map((series) => <HomeChart key={series} series={series} overview={data} loading={overview.isPending} error={overview.isError} onRetry={() => void overview.refetch()} />)}
        </div>
        <HomeClients gateway={gateway} onSessionChanged={onSessionChanged} />
      </main>
    </div>
  )
}
