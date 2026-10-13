import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { supportWhatsAppUrl } from '../../shared/support'
import { Button } from '../../shared/ui/button'
import { Card } from '../../shared/ui/card'
import { PortalHeader } from '../../shared/ui/portal-header'
import { Skeleton } from '../../shared/ui/skeleton'
import type { ProfileGateway } from './api/profile-gateway'
import { ProfileSessionError } from './api/profile-gateway'
import { ChangePasswordModal } from './change-password-modal'
import { profileQuery } from './profile-queries'
import { useProfileAction } from './use-profile-action'

function ProfileField({ label, value, loading }: { label: string; value: string | null | undefined; loading: boolean }) {
  return <div className="flex min-w-0 flex-col gap-2">
    <span className="text-xs font-light leading-5 tracking-[1.6px] text-muted-foreground uppercase">{label}</span>
    {loading ? <span className="flex h-7 min-w-0 items-center"><Skeleton className="h-5 w-40 max-w-full" /></span> : <span className="min-w-0 break-words text-lg font-medium leading-7">{value ?? '—'}</span>}
  </div>
}

export function ProfileScreen({ gateway, signOut, onSessionChanged, onHome, onProfile, knownCompanyName }: { gateway: ProfileGateway; signOut: ReactNode; onSessionChanged: () => Promise<void>; onHome: () => void; onProfile: () => void; knownCompanyName?: string | null | undefined }) {
  const { t } = useAppTranslation()
  const profile = useQuery(profileQuery(gateway))
  const sessions = useProfileAction(onSessionChanged)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordOpener, setPasswordOpener] = useState<HTMLElement | null>(null)
  const data = profile.data

  useEffect(() => {
    if (profile.error instanceof ProfileSessionError) void onSessionChanged().catch(() => undefined)
  }, [profile.error, onSessionChanged])

  return <div className="min-h-dvh min-w-0 font-sans">
    <PortalHeader companyName={data === undefined ? knownCompanyName : data.company} loading={profile.isPending} signOut={signOut} onCompanyClick={onProfile} onLogoClick={onHome} />
    <main className="min-w-0 px-4 pt-8 pb-[60px] sm:px-10">
      <h1 className="sr-only">{t('profile.title')}</h1>
      {profile.isError ? <div className="flex min-h-40 flex-col items-start justify-center gap-4" role="alert"><p className="text-sm text-muted-foreground">{t('profile.error')}</p><Button variant="outline" onClick={() => void profile.refetch()}>{t('common.actions.retry')}</Button></div> :
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-8">
          <Card className="rounded-[10px] p-[31px] lg:min-h-[488px]">
            <h2 className="text-lg font-bold leading-7">{t('profile.account.title')}</h2>
            <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
              <ProfileField label={t('profile.account.fullName')} value={data?.fullName} loading={profile.isPending} />
              <ProfileField label={t('profile.account.email')} value={data?.email} loading={profile.isPending} />
              <ProfileField label={t('profile.account.phone')} value={data?.phone} loading={profile.isPending} />
              <ProfileField label={t('profile.account.company')} value={data?.company} loading={profile.isPending} />
            </div>
          </Card>
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="rounded-[10px] p-[31px]">
              <h2 className="text-lg font-bold leading-7">{t('profile.security.title')}</h2>
              <p className="text-xs font-medium leading-5 text-muted-foreground">{t('profile.security.description')}</p>
              <div className="flex min-w-0 flex-col gap-3">
                <Button textStyle="strong" className="h-9 w-full" disabled={profile.isPending || sessions.pending} onClick={(event) => { setPasswordOpener(event.currentTarget); setPasswordOpen(true) }}>{t('profile.security.changePassword')}</Button>
                <Button variant="outline" textStyle="strong" className="h-9 w-full text-destructive hover:text-destructive" disabled={profile.isPending || sessions.pending} aria-busy={sessions.pending} onClick={() => void sessions.run(() => gateway.revokeOtherSessions(), () => { toast.success(t('profile.security.sessionsRevoked')) })}>{t('profile.security.signOutAll')}</Button>
                {sessions.error ? <p role="alert" className="text-xs leading-5 text-destructive">{sessions.error.message}</p> : null}
              </div>
            </Card>
            <section className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-border p-[23px] text-xs leading-5" aria-label={t('profile.support.title')}>
              <p className="font-medium">{t('profile.support.title')}</p>
              <a href={supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="w-fit tracking-[0.4px] text-muted-foreground underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t('profile.support.description')}</a>
            </section>
          </div>
        </div>}
    </main>
    {passwordOpen ? <ChangePasswordModal gateway={gateway} onSessionChanged={onSessionChanged} onChanged={() => { void profile.refetch() }} onClose={() => setPasswordOpen(false)} returnFocusElement={passwordOpener} /> : null}
  </div>
}
