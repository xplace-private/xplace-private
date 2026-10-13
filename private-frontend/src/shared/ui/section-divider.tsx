/** Shared divider with equal spacing on both sides of its centred line. */
export function SectionDivider() {
  return (
    <div className="relative py-4" aria-hidden="true">
      <div className="absolute inset-x-0 top-1/2 border-t border-border" />
    </div>
  )
}
