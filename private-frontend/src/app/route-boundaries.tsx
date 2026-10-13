import { Navigate } from '@tanstack/react-router'

import { useAppTranslation } from '../shared/i18n/app-i18n'
import { Button } from '../shared/ui/button'

const pageClassName = 'grid min-h-dvh min-w-0 place-items-center p-6 text-center'

export function RouteError() {
  const { t } = useAppTranslation()

  return (
    <main className={pageClassName} role="alert">
      <div>
        <h1 className="text-2xl font-semibold">{t('route.errorTitle')}</h1>
        <p className="mt-3 mb-6 text-neutral-600">
          {t('route.errorDescription')}
        </p>
        <Button size="lg" onClick={() => window.location.reload()}>
          {t('common.actions.refreshPage')}
        </Button>
      </div>
    </main>
  )
}

export function RouteNotFound() {
  return <Navigate to="/" replace />
}
