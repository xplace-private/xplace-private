import type { ComponentProps } from 'react'

import { cn } from '../cn'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn('h-12 w-full min-w-0 border-0 border-b border-border bg-transparent px-0 py-1 text-lg leading-7 font-light text-foreground shadow-xs outline-none placeholder:text-secondary/80 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive', className)}
      {...props}
    />
  )
}
