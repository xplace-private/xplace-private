import type { ComponentProps } from 'react'

import { cn } from '../cn'

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full min-w-0 overflow-x-auto outline outline-1 -outline-offset-1 outline-border">
      <table data-slot="table" className={cn('w-full table-fixed border-collapse text-sm leading-6', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('bg-card', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('bg-background [&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('border-b border-border', className)} {...props} />
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th data-slot="table-head" className={cn('h-[52px] px-2 text-left align-middle text-xs leading-5 font-light tracking-[1.6px] whitespace-nowrap text-muted-foreground uppercase first:pl-6 last:pr-6', className)} {...props} />
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('h-14 px-2 align-middle first:pl-6 last:pr-6', className)} {...props} />
}
