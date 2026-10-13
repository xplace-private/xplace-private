import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '../cn'

const badgeVariants = cva('inline-flex h-6 w-fit shrink-0 items-center justify-center px-2.5 py-0.5 text-xs leading-5 font-bold tracking-[1.6px] whitespace-nowrap uppercase', {
  variants: {
    variant: {
      default: 'bg-primary-foreground text-secondary',
      positive: 'bg-positive/15 text-positive',
      warning: 'bg-warning/15 text-warning',
      destructive: 'bg-destructive/15 text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}
