import { createContext, useContext, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { ResponsiveContainer, Tooltip, type TooltipContentProps } from 'recharts'

import { cn } from '../cn'

export type ChartConfig = Record<string, { label: ReactNode; color: string }>
const ChartContext = createContext<ChartConfig>({})

// shadcn's composition: Recharts owns the plot, this component owns product styling.
export function ChartContainer({ config, children, className, style, ...props }: ComponentProps<'div'> & {
  config: ChartConfig
  children: ComponentProps<typeof ResponsiveContainer>['children']
}) {
  const colors = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]))
  return (
    <ChartContext.Provider value={config}>
      <div data-slot="chart" className={cn('min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_g[tabindex="-1"]]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:outline [&_.recharts-surface:focus-visible]:outline-solid [&_.recharts-surface:focus-visible]:outline-ring', className)} style={{ ...colors, ...style } as CSSProperties} {...props}>
        <ResponsiveContainer initialDimension={{ width: 320, height: 220 }}>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

export const ChartTooltip = Tooltip

export function ChartTooltipContent({ active, payload, label, formatValue }: Partial<TooltipContentProps<number, string>> & { formatValue: (value: number) => string }) {
  const config = useContext(ChartContext)
  if (!active || !payload?.length) return null
  return (
    <div className="grid min-w-48 gap-2 border border-border bg-popover p-3 text-xs shadow-xl">
      <p className="font-medium">{label}</p>
      {payload.filter((item) => item.type !== 'none').map((item) => {
        const key = String(item.dataKey)
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: config[key]?.color }} />
            <span className="text-muted-foreground">{config[key]?.label}</span>
            <span className="ml-auto pl-2 font-medium tabular-nums">{typeof item.value === 'number' ? formatValue(item.value) : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
