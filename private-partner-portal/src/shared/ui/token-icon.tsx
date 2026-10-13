import type { ComponentProps } from 'react'

import { cn } from '../cn'

interface TokenIconProps extends ComponentProps<'span'> {
  src: string
}

/** Decorative monochrome icon whose color comes from the current theme. */
export function TokenIcon({ className, src, style, ...props }: TokenIconProps) {
  const maskImage = `url("${src}")`

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]',
        className,
      )}
      style={{ WebkitMaskImage: maskImage, maskImage, ...style }}
      {...props}
    />
  )
}
