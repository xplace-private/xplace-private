const RELOAD_MARKER = 'private-partner-portal.reload-on-stale-chunk'

export function reloadOnStaleChunk() {
  const reload = (event: Event) => {
    try {
      // ponytail: one automatic reload per tab; reset after a verified successful load if repeated deploy recovery is needed.
      if (sessionStorage.getItem(RELOAD_MARKER)) return
      sessionStorage.setItem(RELOAD_MARKER, '1')
    } catch {
      // Keep the route error and manual refresh available when storage is blocked.
      return
    }

    event.preventDefault()
    window.location.reload()
  }

  window.addEventListener('vite:preloadError', reload)
  return () => window.removeEventListener('vite:preloadError', reload)
}
