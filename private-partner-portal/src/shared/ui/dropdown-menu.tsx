import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../cn'
import { Button } from './button'

export function DropdownMenu(
  props: ComponentProps<typeof DropdownMenuPrimitive.Root>,
) {
  return <DropdownMenuPrimitive.Root {...props} />
}

export function DropdownMenuRadioGroup(
  props: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>,
) {
  return <DropdownMenuPrimitive.RadioGroup {...props} />
}

export function DropdownMenuTrigger(
  props: ComponentProps<typeof DropdownMenuPrimitive.Trigger>,
) {
  return <DropdownMenuPrimitive.Trigger {...props} />
}

export function DropdownMenuSelectorTrigger({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return <DropdownMenuPrimitive.Trigger asChild>
    <Button variant="outline" aria-label={ariaLabel} className="group h-9 gap-4 px-3 font-medium tracking-normal text-muted-foreground normal-case hover:bg-transparent hover:text-accent data-[state=open]:border-accent data-[state=open]:bg-transparent data-[state=open]:text-accent">
      <span className="flex min-w-0 items-center gap-1.5">{children}</span>
      <span aria-hidden="true" className="size-4 shrink-0 rotate-180 bg-current group-data-[state=open]:rotate-0" style={{ mask: "url('/assets/shared/selector-caret-up.svg') center / contain no-repeat" }} />
    </Button>
  </DropdownMenuPrimitive.Trigger>
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={['flex h-8 cursor-default items-center gap-2 px-2 text-xs font-medium outline-none focus:bg-muted/50', className].filter(Boolean).join(' ')} {...props} />
}

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          'z-50 min-w-36 overflow-hidden border border-border bg-popover p-1 text-popover-foreground shadow-2xl outline-none',
          className,
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuRadioItem({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={[
        'relative flex h-8 cursor-default select-none items-center gap-4 px-2 text-xs font-medium tracking-normal outline-none',
        'focus:bg-muted/50 data-[state=checked]:text-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span className="min-w-0 whitespace-nowrap">{children}</span>
      <DropdownMenuPrimitive.ItemIndicator className="ml-auto flex size-4 shrink-0 items-center justify-center"><span className="block size-4 bg-accent" style={{ mask: "url('/assets/shared/selector-check.svg') center / contain no-repeat" }} /></DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  )
}
