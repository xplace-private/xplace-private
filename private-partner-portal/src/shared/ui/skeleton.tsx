import type { ComponentProps, ReactElement } from 'react'

/**
 * Canonical reusable loading block. Callers set geometry and positioning;
 * visual tokens stay shared unless the final shape is explicitly round.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>): ReactElement {
  const classes = [
    'animate-pulse rounded-md bg-border',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div aria-hidden="true" className={classes} {...props} />
}
