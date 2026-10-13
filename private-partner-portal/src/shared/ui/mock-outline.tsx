import type { ReactNode } from 'react'

/** Marks data or actions still supplied by mocks, without a fill. */
export function MockOutline({ children, enabled, inline = false }: { children: ReactNode; enabled: boolean; inline?: boolean }) {
  if (!enabled) return <>{children}</>
  const Tag = inline ? 'span' : 'div'
  return <Tag data-mock="true" className={`relative min-w-0 outline outline-1 outline-[#ff4bb8] outline-offset-2 ${inline ? 'my-1 inline-block max-w-full align-baseline' : ''}`}>
    <span className="pointer-events-none absolute -top-3 left-0 font-mono text-[8px] leading-[10px] font-medium tracking-normal text-[#ff4bb8]" aria-label="Mock data">MOCK</span>
    {children}
  </Tag>
}
