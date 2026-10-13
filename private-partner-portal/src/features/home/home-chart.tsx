import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../../shared/ui/chart'
import { Skeleton } from '../../shared/ui/skeleton'
import type { HomeOverview } from './api/home-gateway'

const skeletonBars = [42, 53, 63, 77, 84, 98, 109, 102, 119, 137, 147, 168]

export function HomeChart({ series, overview, loading, error, onRetry }: { series: 'spend' | 'commission'; overview: HomeOverview | undefined; loading: boolean; error: boolean; onRetry: () => void }) {
  const { t, i18n } = useAppTranslation()
  const config = {
    spend: { label: t('home.spend'), color: 'var(--primary)' },
    commission: { label: t('home.commission'), color: 'var(--warning)' },
  } satisfies ChartConfig
  const data = (series === 'commission' ? overview?.commissionMonthly ?? overview?.monthly : overview?.monthly) ?? []
  function monthLabel(value: string) {
    return (/^\d{4}-\d{2}$/.test(value) ? new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`)) : value).toUpperCase()
  }
  const money = overview ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: overview.currency, maximumFractionDigits: 0 }) : undefined
  const maximum = Math.max(500_000, ...data.map((point) => point[series] ?? 0))
  const axisMaximum = Math.ceil(maximum / 125_000) * 125_000
  const ticks = Array.from({ length: 5 }, (_, index) => axisMaximum * index / 4)

  return (
    <Card aria-busy={loading} aria-label={config[series].label} className="p-[23px] md:p-[31px]">
      <CardHeader>
        <CardTitle>{config[series].label}<span className="text-secondary">/ {t('home.chart.period')}</span></CardTitle>
      </CardHeader>
      <CardContent className="h-[220px]">
        {loading ? (
          <div className="flex h-full gap-4" aria-hidden="true" data-home-chart-skeleton>
            <div className="flex w-[34px] shrink-0 flex-col items-end justify-between">
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex h-4 items-center"><Skeleton className="h-2 w-[34px]" /></div>)}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-12 border-b border-l border-border">
              {skeletonBars.map((height, index) => (
                <div key={index} className="flex min-w-0 flex-col justify-end gap-2">
                  <div className="flex w-full items-end justify-center"><Skeleton className="w-6 max-w-[70%]" style={{ height }} /></div>
                  <div className="flex h-4 items-center justify-center"><Skeleton className="h-2 w-5 max-w-full" /></div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4" role="alert">
            <p className="text-sm text-muted-foreground">{t('home.overviewError')}</p>
            <Button variant="outline" onClick={onRetry}>{t('common.actions.retry')}</Button>
          </div>
        ) : data.length === 0 || data.every((point) => point[series] === null) ? (
          <p className="grid h-full place-items-center text-sm text-muted-foreground">{t('home.chart.empty')}</p>
        ) : (
          <div className="flex h-full gap-4">
            <div aria-hidden="true" className="flex w-[34px] shrink-0 flex-col items-end justify-between text-[8px] leading-4 font-bold tracking-[1.6px] text-muted-foreground uppercase">
              {[...ticks].reverse().map((value) => <span key={value}>{value === 0 ? money?.format(0) ?? '—' : (money?.format(value / 1000) ?? '—') + 'k'}</span>)}
            </div>
            <ChartContainer config={config} className="h-full min-w-0 flex-1 border-b border-l border-border">
              <BarChart accessibilityLayer aria-label={config[series].label} data={data} barCategoryGap="18%" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" horizontalCoordinatesGenerator={({ height }) => [0, height / 3, height * 2 / 3, height]} />
                <XAxis dataKey="month" height={24} interval="preserveStartEnd" minTickGap={16} tickLine={false} tickMargin={8} axisLine={false} tick={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.6 }} tickFormatter={monthLabel} />
                <YAxis hide domain={[0, axisMaximum]} />
                <ChartTooltip isAnimationActive={false} cursor={{ fill: 'var(--muted)', opacity: 0.12 }} content={<ChartTooltipContent formatValue={(value) => money?.format(value) ?? '—'} />} />
                <Bar dataKey={series} fill={`var(--color-${series})`} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
