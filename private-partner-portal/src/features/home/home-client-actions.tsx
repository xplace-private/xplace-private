import { useId, useRef, type Ref } from 'react'

import { cn } from '../../shared/cn'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { supportWhatsAppUrl } from '../../shared/support'
import { Button } from '../../shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../shared/ui/dropdown-menu'
import type { PartnerClient } from './api/home-gateway'
import { clientDate } from './client-date'

export function ClientActionInfo({ client, containerRef }: { client: PartnerClient; containerRef?: Ref<HTMLDivElement> }) {
  const { t, i18n } = useAppTranslation()
  const id = useId()
  if (client.status !== 'limit-review' && client.status !== 'onboarding' && client.status !== 'closed') return null
  const title = t(`home.clients.actionInfo.${client.status}.title`)
  const description = t(`home.clients.actionInfo.${client.status}.description`, { date: clientDate(client.closedAt, 'long', i18n.language) })
  return <div ref={containerRef} role="group" tabIndex={-1} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="min-w-0 max-w-full px-4 py-1.5 outline-none">
    <div className="flex min-w-0 flex-col gap-0.5 text-xs leading-5 text-secondary">
      <p id={`${id}-title`} className="font-sans font-medium">{title}</p>
      <p id={`${id}-description`} className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] font-light">{description}</p>
    </div>
  </div>
}

export function HomeClientActions({ client, onOpen, disabled = false }: { client: PartnerClient; onOpen: (opener: HTMLElement | null) => void; disabled?: boolean }) {
  const { t } = useAppTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const isInfo = client.status === 'limit-review' || client.status === 'onboarding' || client.status === 'closed'
  const hasStatusContent = isInfo || client.status === 'active' || client.status === 'contact-support'
  function openClient() { window.requestAnimationFrame(() => onOpen(triggerRef.current)) }
  function action(label: string, icon: string) {
    return <DropdownMenuItem key={label} asChild className="gap-4! pl-4! pr-2! font-sans text-xs font-medium">
      <a href={supportWhatsAppUrl} target="_blank" rel="noopener noreferrer">
        <span className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap"><img src={icon} alt="" className="size-4 shrink-0 brightness-0 invert" />{label}</span>
        <img src="/assets/home/caret-right.svg" alt="" className="size-4 shrink-0 brightness-0 invert" />
      </a>
    </DropdownMenuItem>
  }

  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><Button ref={triggerRef} disabled={disabled} variant="ghost" size="back" className="size-6" aria-label={t('home.clients.actionsFor', { name: client.name ?? client.email ?? client.id })}><img src="/assets/home/dots.svg" alt="" className="size-6 brightness-0 invert" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent
      side="left"
      align="center"
      sideOffset={12}
      {...(hasStatusContent ? { collisionPadding: 20 } : {})}
      className={cn('min-w-0', hasStatusContent && 'max-w-[min(calc(100dvw-40px),var(--radix-dropdown-menu-content-available-width))] py-[3px] shadow-md')}
      onFocus={isInfo ? (event) => {
        if (event.target === event.currentTarget) infoRef.current?.focus()
      } : undefined}
    >
      {client.status === 'active' ? <>
        {action(t('home.clients.actions.aumReview'), '/assets/home/coins.svg')}
        {action(t('home.clients.actions.requestOffboarding'), '/assets/home/request-offboarding.svg')}
      </> : client.status === 'contact-support' ? action(t('home.clients.actions.contactSupport'), '/assets/home/headset.svg') : isInfo ? <ClientActionInfo client={client} containerRef={infoRef} /> :
        <DropdownMenuItem onSelect={openClient}>{t('home.clients.open')}<img src="/assets/home/caret-right.svg" alt="" className="size-4 brightness-0 invert" /></DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>
}
