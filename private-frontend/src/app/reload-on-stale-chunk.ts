const RELOAD_MARKER = 'reload-on-stale-chunk'

// Деплой удаляет чанки предыдущей сборки: у открытой вкладки ленивый импорт даёт 404.
export function reloadOnStaleChunk() {
  window.addEventListener('vite:preloadError', () => {
    if (sessionStorage.getItem(RELOAD_MARKER)) {
      return
    }

    sessionStorage.setItem(RELOAD_MARKER, '1')
    window.location.reload()
  })
}
