import type { ReactNode } from 'react'

import { Button } from '../../../shared/ui/button'

interface AgreementDisclosureProps {
  id: string
  title: string
  expanded: boolean
  children: ReactNode
  onToggle(): void
}

/** Controlled agreement disclosure matching the compact onboarding terms panel. */
export function AgreementDisclosure({
  id,
  title,
  expanded,
  children,
  onToggle,
}: AgreementDisclosureProps) {
  const contentId = `${id}-content`

  return (
    <div className={`flex min-w-0 flex-col gap-3.5 border border-border p-[18px] ${expanded ? 'bg-card' : ''}`}>
      <Button
        className="h-auto w-full justify-between gap-4 px-0 py-0 text-left text-[13px] leading-none font-light text-foreground normal-case"
        variant="ghost"
        aria-controls={contentId}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="min-w-0">{title}</span>
        <span className="shrink-0 text-secondary" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
      </Button>

      {expanded && (
        <div
          className="max-h-[190px] min-w-0 overflow-y-auto overscroll-y-contain pb-2.5 text-xs leading-[20.4px] font-light text-secondary"
          id={contentId}
        >
          {children}
        </div>
      )}
    </div>
  )
}
