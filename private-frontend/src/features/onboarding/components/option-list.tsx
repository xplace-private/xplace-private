import {
  Children,
  type ComponentPropsWithoutRef,
  type UIEvent,
  useLayoutEffect,
  useRef,
} from 'react'

type OptionListProps = ComponentPropsWithoutRef<'div'>

function syncScrollbar(
  scrollElement: HTMLDivElement | null,
  thumbElement: HTMLDivElement | null,
) {
  if (scrollElement === null || thumbElement === null) return

  const { clientHeight, scrollHeight, scrollTop } = scrollElement
  const thumbHeight = (clientHeight / scrollHeight) * clientHeight
  const maxThumbTop = clientHeight - thumbHeight
  const maxScrollTop = scrollHeight - clientHeight
  const unclampedThumbTop =
    maxScrollTop === 0 ? 0 : (scrollTop / maxScrollTop) * maxThumbTop
  const thumbTop = Math.min(Math.max(unclampedThumbTop, 0), maxThumbTop)

  thumbElement.style.height = `${thumbHeight}px`
  thumbElement.style.transform = `translateY(${thumbTop}px)`
}

/** Keeps onboarding choices compact and scrolls after the fifth option. */
export function OptionList({
  children,
  className = '',
  onScroll,
  ...props
}: OptionListProps) {
  const isScrollable = Children.count(children) > 5
  const scrollRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isScrollable) return

    syncScrollbar(scrollRef.current, thumbRef.current)
  }, [children, isScrollable])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    syncScrollbar(scrollRef.current, thumbRef.current)
    onScroll?.(event)
  }

  return (
    <div className="relative min-w-0 overflow-hidden">
      <div
        ref={scrollRef}
        className={`flex max-h-[315px] min-w-0 flex-col gap-2 overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isScrollable ? 'overflow-y-auto pr-[11px]' : 'overflow-y-visible'} ${className}`}
        onScroll={handleScroll}
        {...props}
      >
        {children}
      </div>
      {isScrollable && (
        <div
          ref={thumbRef}
          className="pointer-events-none absolute top-0 right-0 w-[3px] bg-muted"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
