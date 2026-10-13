import type { ReactNode } from 'react'

interface SectionHeaderProps {
  action?: ReactNode
  children: ReactNode
}

/** Shared heading row for content sections with an optional trailing action. */
export function SectionHeader({ action, children }: SectionHeaderProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 pt-px">
      <h2 className="text-[15px] leading-none font-bold tracking-[-0.2px]">{children}</h2>
      {action}
    </div>
  )
}
