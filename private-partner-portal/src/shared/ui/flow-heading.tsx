import type { ReactNode } from 'react'

interface FlowHeadingProps {
  eyebrow: string
  title: string
  description?: ReactNode
}

/** Shared heading treatment for portal flow steps. */
export function FlowHeading({ eyebrow, title, description }: FlowHeadingProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 font-sans">
      <p className="text-xs leading-5 font-light tracking-[1.6px] text-muted uppercase">
        {eyebrow}
      </p>
      <h1 className="text-[32px] leading-10 font-bold tracking-normal text-foreground">
        {title}
      </h1>
      {description !== undefined && (
        <p className="text-sm leading-6 font-light text-secondary">
          {description}
        </p>
      )}
    </div>
  )
}
