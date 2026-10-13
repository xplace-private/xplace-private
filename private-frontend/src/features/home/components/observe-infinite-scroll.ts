export function observeInfiniteScroll(
  node: Element,
  onLoadMore: () => void,
  Observer: typeof IntersectionObserver = IntersectionObserver,
): () => void {
  const observer = new Observer(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
    },
    { rootMargin: '240px 0px' },
  )
  observer.observe(node)
  return () => observer.disconnect()
}
