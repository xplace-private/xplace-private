import { useEffect, useRef } from 'react'

import { observeInfiniteScroll } from './observe-infinite-scroll'

interface TransactionInfiniteScrollProps {
  enabled: boolean
  onLoadMore: () => void
}

export function TransactionInfiniteScroll({
  enabled,
  onLoadMore,
}: TransactionInfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!enabled || node === null || typeof IntersectionObserver === 'undefined') return
    return observeInfiniteScroll(node, onLoadMore)
  }, [enabled, onLoadMore])

  return (
    <div
      className="h-px w-full"
      aria-hidden="true"
      data-infinite-scroll="transactions"
      ref={sentinelRef}
    />
  )
}
