import type { ReactElement } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { InfoBanner } from '../../shared/ui/info-banner'
import { Skeleton } from '../../shared/ui/skeleton'
import { HomeContentFrame } from './home-screen'

const statPanelClassName =
  'row-start-1 row-span-2 grid min-w-0 grid-rows-subgrid gap-y-4 border border-border bg-card px-4 pt-4 pb-[21px]'

function WrappedStatValueSkeleton() {
  const { t } = useAppTranslation()

  return (
    <div className="relative min-w-0">
      <div
        className="invisible flex min-w-0 flex-col gap-2"
        aria-hidden="true"
      >
        <strong className="text-[21px] leading-none font-bold tracking-[-0.8px] whitespace-nowrap">
          USD 499.88
        </strong>
        <span className="flex items-center gap-1 text-[11px] leading-[14px] font-light text-secondary">
          {t('home.statement.periodDue', { date: '5 Sep' })}
        </span>
      </div>
      <div className="absolute inset-0 flex min-w-0 flex-col gap-2">
        <Skeleton className="h-[21px] w-20 max-w-full" />
        <Skeleton className="min-h-[14px] w-full flex-1" />
      </div>
    </div>
  )
}

function StatPanelSkeleton({
  className,
  paymentAction = false,
  wrappedSecondary = false,
}: {
  className: string
  paymentAction?: boolean
  wrappedSecondary?: boolean
}) {
  return (
    <section className={`${statPanelClassName} ${className}`}>
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="size-5" />
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-[21px] w-24 max-w-full" />
          <Skeleton className="h-[14px] w-20 max-w-full" />
        </div>
      </div>
      <div className={`border-t border-border ${paymentAction ? 'pt-[14px]' : 'pt-4'}`}>
        {paymentAction ? (
          <Skeleton className="h-10 w-full" />
        ) : wrappedSecondary ? (
          <WrappedStatValueSkeleton />
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-[21px] w-20 max-w-full" />
            <Skeleton className="h-[14px] w-20 max-w-full" />
          </div>
        )}
      </div>
    </section>
  )
}

function ActionTileSkeleton({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-4 border border-border bg-card px-4 py-4">
      <Skeleton className="size-6 shrink-0" />
      <div className="relative min-w-0 flex-1">
        <div
          className="invisible flex min-w-0 flex-col gap-0.5 font-light tracking-[1.6px]"
          aria-hidden="true"
        >
          <span className="text-xs leading-5 text-foreground">{title}</span>
          <span className="text-xs leading-5 text-secondary">
            {description}
          </span>
        </div>
        <div className="absolute inset-0 flex min-w-0 flex-col gap-0.5">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="min-h-5 w-full flex-1" />
        </div>
      </div>
      <Skeleton className="size-4 shrink-0" />
    </div>
  )
}

/** Home-shaped loading state used while the stored session is validated. */
export function HomeSessionSkeleton(): ReactElement {
  const { t } = useAppTranslation()

  return (
    <HomeContentFrame>
      <div className="min-w-0" data-layout-slot="card">
        <section className="relative flex aspect-[343/216] w-full min-w-0 items-end overflow-hidden rounded-2xl border-[0.25px] border-transparent px-4 py-8">
          <Skeleton className="absolute inset-0 size-full rounded-2xl" />
        </section>
      </div>

      <div className="min-w-0" data-layout-slot="banner">
        <InfoBanner variant="neutral">
          <div className="relative min-w-0">
            <div
              className="invisible flex min-w-0 flex-col gap-1"
              aria-hidden="true"
            >
              <p>{t('home.statement.days', { count: 19 })}</p>
              <p className="font-light text-secondary">
                {t('home.statement.dueSummary', {
                  amount: 'USD 3,034.90',
                  date: '5 Sep',
                })}
              </p>
            </div>
            <div className="absolute inset-0 flex min-w-0 flex-col gap-1">
              <Skeleton className="h-[19.2px] w-16" />
              <Skeleton className="min-h-[19.2px] w-full flex-1" />
            </div>
          </div>
        </InfoBanner>
      </div>

      <div
        className="grid min-w-0 grid-cols-2 gap-x-2"
        data-layout-slot="stats"
      >
        <StatPanelSkeleton className="col-start-1" wrappedSecondary />
        <StatPanelSkeleton className="col-start-2" paymentAction />
      </div>

      <div className="min-w-0" data-layout-slot="management">
        <section className="flex min-w-0 flex-col gap-4 border border-border bg-card p-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-52 max-w-full" />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 gap-2">
              <Skeleton className="h-9 min-w-0 flex-1" />
              <Skeleton className="h-9 min-w-0 flex-1" />
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
        </section>
      </div>

      <div className="min-w-0" data-layout-slot="getting-started">
        <section className="flex min-w-0 flex-col gap-4 py-4">
          <Skeleton className="h-[10px] w-24" />
          <div className="flex min-w-0 flex-col gap-2">
            <ActionTileSkeleton
              title={t('home.gettingStarted.walletTitle')}
              description={t('home.gettingStarted.walletDescription')}
            />
            <ActionTileSkeleton
              title={t('home.gettingStarted.physicalTitle')}
              description={t('home.gettingStarted.physicalDescription')}
            />
          </div>
        </section>
      </div>
    </HomeContentFrame>
  )
}
