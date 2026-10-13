import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { Loader } from '../../shared/ui/loader'
import type { AuthGateway } from './api/auth-gateway'
import { useAuthAction } from './use-auth-action'

interface SignOutButtonProps {
  gateway: AuthGateway
  onSessionChanged(): Promise<void>
}

export function SignOutButton({ gateway, onSessionChanged }: SignOutButtonProps) {
  const { t } = useAppTranslation()
  const { pending, error, run } = useAuthAction(onSessionChanged)

  return (
    <div className="flex min-w-0 flex-col items-center gap-4">
      <Button variant="ghost" className="h-6 gap-1.5 border-0 p-0 font-medium tracking-normal text-foreground normal-case" disabled={pending} aria-label={t('auth.signOut')} onClick={() => void run(() => gateway.signOut())}>
        {pending ? <span className="grid size-6 place-items-center"><Loader tone="light" /></span> : <img src="/assets/home/sign-out.svg" alt="" className="size-6 brightness-0 invert" />}
        {t('auth.signOut')}
      </Button>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
