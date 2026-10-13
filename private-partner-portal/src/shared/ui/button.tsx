import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import type * as React from 'react'

import { cn } from '../cn'

const buttonVariants = cva(
  "inline-flex min-w-0 shrink-0 items-center justify-center gap-1.5 overflow-hidden border border-transparent tracking-[1.6px] uppercase whitespace-nowrap shadow-xs transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 [&_img]:pointer-events-none [&_img]:select-none [&_img]:transition-[filter] [&_img]:[-webkit-user-drag:none] motion-reduce:[&_img]:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary',
        destructive: 'bg-destructive text-foreground hover:bg-destructive',
        outline:
          'border-border bg-transparent text-foreground hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground',
        surface:
          'border-border bg-card text-foreground hover:border-muted',
        ghost: 'border-transparent text-secondary shadow-none hover:text-primary',
        link: 'border-transparent text-secondary shadow-none normal-case hover:text-primary hover:underline',
      },
      size: {
        compact:
          "px-2.5 py-px text-[8px] leading-5 has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-end]:pr-2 [&_img:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
        sm: "px-4 py-[5px] text-xs leading-5 [&_img:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4",
        nav: "px-2.5 py-[7px] text-xs leading-5 [&_img:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
        default:
          "px-4 py-[7px] text-xs leading-5 [&_img:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4",
        md: "px-4 py-[9px] text-xs leading-5 [&_img:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4",
        lg: "px-4 py-[13px] text-xs leading-5 [&_img:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4",
        chip: "px-3.5 py-[8.5px] text-[11px] leading-[13px] tracking-[1.4px] [&_img:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
        support: "px-4 py-[7px] text-[10px] leading-5 [&_img:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
        back: "gap-[7px] border-0 p-0 text-[11px] leading-[13px] [&_img:not([class*='size-'])]:size-[13px] [&_svg:not([class*='size-'])]:size-[13px]",
        'icon-sm': "p-[9px] [&_img:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
        icon: "p-[11px] [&_img:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
        'icon-md': "p-[9px] [&_img:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4",
        'icon-lg': "p-[15px] [&_img:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4",
      },
      textStyle: {
        regular: 'font-sans font-normal',
        strong: 'font-sans font-bold',
        light: 'font-sans font-light',
        body: 'font-[family-name:inherit] font-normal',
        'body-light': 'font-[family-name:inherit] font-light',
      },
      withIcon: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { variant: 'outline', withIcon: true, className: 'bg-background' },
      { variant: 'default', size: 'chip', className: 'hover:bg-primary' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      textStyle: 'regular',
      withIcon: false,
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant = 'default',
  size = 'default',
  textStyle = 'regular',
  withIcon = false,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-text-style={textStyle}
      className={cn(buttonVariants({ variant, size, textStyle, withIcon, className }))}
      type={asChild ? undefined : type}
      {...props}
    />
  )
}

export { Button }
export type { ButtonProps }
