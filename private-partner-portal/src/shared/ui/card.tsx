import type { ComponentProps } from 'react'

import { cn } from '../cn'

// shadcn Card anatomy with the portal's square, inset-border surface.
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section data-slot="card" className={cn('flex min-w-0 flex-col gap-6 border border-border bg-card p-[31px]', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex min-w-0 flex-wrap items-center justify-between gap-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('text-base leading-6 font-bold uppercase', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('min-w-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex min-w-0 flex-wrap items-center justify-between gap-4', className)} {...props} />
}
