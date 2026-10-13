import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Skeleton } from './skeleton'

interface MetricCardProps {
  label: string
  value: string
  detail?: ReactNode
  loading: boolean
  valueWidth: number
  detailWidth?: number
}

export function MetricCard({ label, value, detail, loading, valueWidth, detailWidth }: MetricCardProps) {
  return (
    <Card className="h-[164px] justify-between gap-0 p-[23px]" aria-busy={loading}>
      <CardHeader>
        <CardTitle className="text-xs leading-5 tracking-[1.6px] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-[68px] flex-col gap-1">
        <div className="flex h-12 items-center text-4xl leading-12 font-bold">
          {loading ? <Skeleton className="h-9 max-w-full" style={{ width: valueWidth }} /> : value}
        </div>
        <div className="flex h-4 items-center gap-2 text-[8px] leading-4 font-bold tracking-[1.6px] text-secondary uppercase">
          {loading && detailWidth ? <Skeleton className="h-2 max-w-full" style={{ width: detailWidth }} /> : !loading ? detail : null}
        </div>
      </CardContent>
    </Card>
  )
}
