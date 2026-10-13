import type { ComponentProps } from 'react'

import { cn } from '../cn'
import { Button, type ButtonProps } from './button'

export function Pagination({ className, ...props }: ComponentProps<'nav'>) {
  return <nav data-slot="pagination" className={cn('flex min-w-0', className)} {...props} />
}

export function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return <ul data-slot="pagination-content" className={cn('flex items-center gap-1', className)} {...props} />
}

export function PaginationItem(props: ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

export function PaginationButton({ isActive, className, ...props }: ButtonProps & { isActive?: boolean }) {
  return <Button data-slot="pagination-button" aria-current={isActive ? 'page' : undefined} variant={isActive ? 'outline' : 'ghost'} className={cn('h-9 min-w-9 px-3 font-medium tracking-normal text-foreground normal-case', className)} {...props} />
}
