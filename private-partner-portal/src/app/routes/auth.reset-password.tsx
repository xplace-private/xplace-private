import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ResetPasswordScreen } from '../../features/auth/password-recovery-screen'
import { useAppTranslation } from '../../shared/i18n/app-i18n'

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordRoute,
  validateSearch: (search: Record<string, unknown>): { token: string | null } => ({
    token: typeof search.token === 'string' && search.token.trim() ? search.token.trim() : null,
  }),
})

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function ResetPasswordRoute() {
  const { authGateway } = Route.useRouteContext()
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const { t } = useAppTranslation()

  return <ResetPasswordScreen key={token} gateway={authGateway} token={token}
    onBackToSignIn={() => void navigate({ to: '/auth/sign-in' })}
    onPasswordReset={async () => {
      await navigate({ to: '/auth/sign-in', replace: true })
      toast.success(t('auth.resetPassword.success'))
    }} />
}
