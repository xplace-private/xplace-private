import { Navigate } from '@tanstack/react-router'

import { useAppTranslation } from '../shared/i18n/app-i18n'
import { Loader } from '../shared/ui/loader'

export function RoutePending() {
  const { t } = useAppTranslation()
  return <main className="grid min-h-dvh min-w-0 place-items-center p-8" role="status">
    <div className="flex min-w-0 items-center gap-3"><Loader decorative tone="light" /><span>{t('common.loading')}</span></div>
  </main>
}

export function RouteError() {
  const { t } = useAppTranslation()

  return (
    <main className="grid min-h-dvh min-w-0 place-items-center p-8 text-center max-sm:p-6" role="alert">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{t('route.errorTitle')}</h1>
        <p className="mt-3 mb-6 text-muted-foreground">{t('route.errorDescription')}</p>
        <button
          type="button"
          className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          onClick={() => window.location.reload()}
        >
          {t('common.actions.refreshPage')}
        </button>
      </div>
    </main>
  )
}

export function RouteNotFound() {
  return <Navigate to="/" replace />
}
