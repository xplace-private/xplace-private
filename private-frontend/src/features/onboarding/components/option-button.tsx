import type { ReactNode } from 'react'

import { Button } from '../../../shared/ui/button'
import { TokenIcon } from '../../../shared/ui/token-icon'

interface OptionButtonProps {
  selected: boolean
  warning: boolean
  disabled: boolean
  children: ReactNode
  onClick(): void
}

/** Selectable onboarding option with Figma-matched neutral, selected, and warning states. */
export function OptionButton({
  selected,
  warning,
  disabled,
  children,
  onClick,
}: OptionButtonProps) {
  const borderClass = warning
    ? 'border-destructive'
    : selected
      ? 'border-accent'
      : 'border-border hover:border-muted'

  return (
    <Button
      className={`h-auto w-full justify-between px-4 py-[11px] text-left text-sm leading-6 normal-case shadow-none hover:bg-transparent hover:text-foreground active:bg-transparent active:text-foreground hover:[&_img]:brightness-100 disabled:opacity-100 ${borderClass}`}
      variant="outline"
      textStyle="light"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 whitespace-normal">{children}</span>
      </span>
      <span className="size-4 shrink-0" aria-hidden="true">
        {selected && (
          <TokenIcon
            className={`size-4 ${warning ? 'text-destructive' : 'text-accent'}`}
            src="/assets/onboarding/option-check.svg"
          />
        )}
      </span>
    </Button>
  )
}
