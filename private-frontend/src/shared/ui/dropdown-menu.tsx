import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps } from 'react'

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

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={[
          'z-50 min-w-36 overflow-hidden border border-border bg-popover p-1 text-popover-foreground shadow-2xl outline-none',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
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
        'relative flex cursor-default select-none items-center py-2 pr-3 pl-8 text-xs tracking-[1.2px] outline-none',
        'focus:bg-muted/50 data-[state=checked]:bg-muted/50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span className="absolute left-3 flex size-3 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <span className="block size-1.5 bg-primary" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}
