import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '../../shared/cn'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../shared/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSelectorTrigger } from '../../shared/ui/dropdown-menu'
import { Input } from '../../shared/ui/input'
import { Pagination, PaginationButton, PaginationContent, PaginationItem } from '../../shared/ui/pagination'
import { Skeleton } from '../../shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../shared/ui/table'
import { ClientNotFoundError, HomeSessionError, clientFilterStatuses, type ClientsQuery, type ClientStatus, type HomeGateway, type PartnerClient } from './api/home-gateway'
import { ClientPaymentModal } from './client-payment-modal'
import { ClientPartnerReviewModal } from './client-partner-review-modal'
import { formatClientPhone } from './client-phone'
import { HomeClientActions } from './home-client-actions'
import { clientsQuery } from './home-queries'

const pageSizes = [10, 25, 50]
const badgeTone = { active: 'positive', overdue: 'warning', suspended: 'destructive', 'partner-review': 'warning', 'limit-review': 'warning', 'offboarding-pending': 'warning', onboarding: 'default', closed: 'default', 'contact-support': 'default' } as const
const skeletonWidths = [160, 156, 138, 110, 132, 24]

export function HomeClients({ gateway, onSessionChanged }: { gateway: HomeGateway; onSessionChanged: () => Promise<void> }) {
  const { t, i18n } = useAppTranslation()
  const [search, setSearch] = useState('')
  const activeFilterRef = useRef<HTMLButtonElement | null>(null)
  const [selectedClient, setSelectedClient] = useState<{ client: PartnerClient; opener: HTMLElement | null } | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [query, setQuery] = useState<ClientsQuery>({ search: '', status: 'all', page: 1, pageSize: 10 })
  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => current.search === search.trim() ? current : { ...current, search: search.trim(), page: 1 }), 250)
    return () => clearTimeout(timer)
  }, [search])
  const result = useQuery({ ...clientsQuery(gateway, query), placeholderData: keepPreviousData })
  useEffect(() => {
    if (result.error instanceof HomeSessionError) void onSessionChanged().catch(() => undefined)
  }, [result.error, onSessionChanged])
  useEffect(() => () => detailRequest.current?.abort(), [])
  async function openClient(client: PartnerClient, opener: HTMLElement | null) {
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    setOpeningId(client.id)
    try {
      const loaded = await gateway.getClient(client.id, controller.signal)
      if (!controller.signal.aborted) setSelectedClient({ client: loaded, opener })
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof HomeSessionError) await onSessionChanged().catch(() => undefined)
        else toast.error(t(error instanceof ClientNotFoundError ? 'home.clients.unavailable' : 'home.clients.error'))
      }
    } finally {
      if (!controller.signal.aborted) { detailRequest.current = null; setOpeningId(null) }
    }
  }
  const loading = result.isPending || result.isPlaceholderData || search.trim() !== query.search
  const pageSize = query.pageSize
  const data = result.isPlaceholderData ? undefined : result.data
  const page = data?.page ?? query.page
  const pageCount = data ? Math.max(1, Math.ceil(data.total / pageSize)) : Math.max(4, query.page)
  const firstPage = Math.max(1, Math.min(page - 1, pageCount - 2))
  const visiblePages = Array.from({ length: Math.min(3, pageCount) }, (_, index) => firstPage + index)
  const date = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
  function filter(status: ClientStatus | 'all') {
    setQuery({ search: search.trim(), status, page: 1, pageSize })
  }
  function goToPage(next: number) {
    setQuery((current) => ({ ...current, page: next }))
  }

  return (
    <>
    <Card aria-labelledby="clients-title" className="p-[23px] md:p-[31px]">
      <CardHeader><CardTitle id="clients-title">{t('home.clients.title')}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('home.clients.search')} aria-label={t('home.clients.search')} className="max-w-80" />
        <div className="flex h-8 min-w-0 gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t('home.clients.filter')}>
          {(['all', ...clientFilterStatuses] as const).map((status) => (
            <Button key={status} ref={query.status === status ? activeFilterRef : undefined} variant={query.status === status ? 'default' : 'outline'} size="chip" textStyle="body" aria-pressed={query.status === status} onClick={() => filter(status)} className={cn('h-8 gap-1 px-2 py-0', query.status !== status && 'text-secondary', status === 'all' && 'px-3.5')}>
              {t(`home.clients.status.${status}`)}
              <div className={cn('inline-flex w-[2ch] justify-center', query.status === status ? 'text-secondary' : 'text-muted')}>
                {result.data?.counts[status] ?? '—'}
              </div>
            </Button>
          ))}
        </div>
        <div className="relative">
          <Table aria-label={t('home.clients.title')} aria-busy={loading} className="min-w-[1100px]">
            <colgroup>
              <col style={{ width: 'calc((100% - 480px) / 3 + 16px)' }} />
              <col style={{ width: 'calc((100% - 480px) / 3)' }} />
              <col style={{ width: 'calc((100% - 480px) / 3)' }} />
              <col className="w-[156px]" /><col className="w-[216px]" /><col className="w-[92px]" />
            </colgroup>
            <TableHeader><TableRow>
              {['email', 'phone', 'name', 'registeredAt', 'status', 'actions'].map((column, index) => <TableHead key={column} scope="col" className={index >= 3 ? 'text-right' : ''}>{t(`home.clients.columns.${column}`)}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({ length: pageSize }, (_, row) => (
                <TableRow key={row} aria-hidden="true" data-client-skeleton>
                  {skeletonWidths.map((width, column) => <TableCell key={column}><Skeleton className={cn(column >= 4 ? 'h-6' : 'h-3.5', column >= 3 && 'ml-auto')} style={{ width }} /></TableCell>)}
                </TableRow>
              )) : result.isError || data?.items.length === 0 ? (
                <TableRow aria-hidden="true"><TableCell colSpan={6} className="h-40" /></TableRow>
              ) : <>
                {data?.items.map((client) => (
                  <TableRow key={client.id} className={cn(client.status === 'suspended' && 'bg-destructive/10', client.status === 'overdue' && 'bg-warning/10')}>
                    <TableCell className="truncate" title={client.email ?? undefined}>{client.email ?? '—'}</TableCell>
                    <TableCell>{formatClientPhone(client.phone) ?? '—'}</TableCell>
                    <TableCell className="truncate" title={client.name ?? undefined}>{client.name ?? '—'}</TableCell>
                    <TableCell className="text-right">{client.registeredAt === null ? '—' : <time dateTime={client.registeredAt}>{date.format(new Date(client.registeredAt))}</time>}</TableCell>
                    <TableCell className="text-right"><Badge variant={badgeTone[client.status]}>{t(`home.clients.status.${client.status}`)}</Badge></TableCell>
                    <TableCell className="text-right"><HomeClientActions client={client} disabled={openingId === client.id} onOpen={(opener) => void openClient(client, opener)} /></TableCell>
                  </TableRow>
                ))}
              </>}
            </TableBody>
          </Table>
          {!loading && (result.isError || data?.items.length === 0) ? (
            <div className="absolute inset-x-0 top-[52px] flex h-40 flex-col items-center justify-center gap-4 p-4 text-center" role={result.isError ? 'alert' : 'status'}>
              <p className="text-sm text-muted-foreground">{t(result.isError ? 'home.clients.error' : 'home.clients.empty')}</p>
              {result.isError ? <Button variant="outline" onClick={() => void result.refetch()}>{t('common.actions.retry')}</Button> : query.search || query.status !== 'all' ? <Button variant="outline" onClick={() => { setSearch(''); setQuery({ search: '', status: 'all', page: 1, pageSize }) }}>{t('home.clients.reset')}</Button> : null}
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuSelectorTrigger ariaLabel={t('home.clients.rowsPerPage')}>{t('home.clients.rows', { count: pageSize })}</DropdownMenuSelectorTrigger>
            <DropdownMenuContent align="start" className="min-w-0 w-[var(--radix-dropdown-menu-trigger-width)] py-[3px]">
              <DropdownMenuRadioGroup value={String(pageSize)} onValueChange={(value) => setQuery((current) => ({ ...current, page: 1, pageSize: Number(value) }))}>
                {pageSizes.map((size) => <DropdownMenuRadioItem key={size} value={String(size)}>{t('home.clients.rows', { count: size })}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div role="status" className="flex h-5 items-center text-xs leading-5 font-medium text-muted-foreground">
            {loading ? <><span className="sr-only">{t('common.loading')}</span><Skeleton className="h-3 w-[132px]" /></> : result.isError ? '—' : t('home.clients.showing', { count: data?.items.length ?? 0, total: data?.total ?? 0 })}
          </div>
        </div>
        <Pagination aria-label={t('home.clients.pagination')} className="w-full sm:w-auto">
          <PaginationContent className="w-full justify-between gap-2 sm:w-auto sm:justify-start sm:gap-1">
            <PaginationItem><PaginationButton disabled={loading || result.isError || page <= 1} onClick={() => goToPage(page - 1)} aria-label={t('home.clients.previous')} className="size-11 min-w-11 p-0 sm:h-9 sm:w-auto sm:min-w-9 sm:px-3"><img src="/assets/home/caret-right.svg" alt="" className="size-4 rotate-180 brightness-0 invert" /><span className="hidden sm:inline">{t('home.clients.previous')}</span></PaginationButton></PaginationItem>
            <PaginationItem className="flex min-w-0 flex-1 items-center justify-center text-xs font-medium leading-5 text-muted-foreground sm:hidden" role="status">{loading ? <><span className="sr-only">{t('common.loading')}</span><Skeleton className="h-3 w-20 max-w-full" /></> : result.isError ? '—' : t('home.clients.pageOf', { page, total: pageCount })}</PaginationItem>
            {firstPage > 1 ? <PaginationItem className="hidden sm:block"><PaginationButton aria-label={t('home.clients.page', { page: firstPage - 1 })} disabled={loading || result.isError} onClick={() => goToPage(firstPage - 1)}>…</PaginationButton></PaginationItem> : null}
            {visiblePages.map((value) => <PaginationItem key={value} className="hidden sm:block"><PaginationButton isActive={page === value} disabled={loading || result.isError} aria-label={t('home.clients.page', { page: value })} onClick={() => goToPage(value)} className="w-9 px-0">{loading ? <Skeleton className="h-3 w-2" /> : value}</PaginationButton></PaginationItem>)}
            {firstPage + visiblePages.length <= pageCount ? <PaginationItem className="hidden sm:block"><PaginationButton aria-label={t('home.clients.page', { page: firstPage + visiblePages.length })} disabled={loading || result.isError} onClick={() => goToPage(firstPage + visiblePages.length)} className="w-9 px-0">…</PaginationButton></PaginationItem> : null}
            <PaginationItem><PaginationButton disabled={loading || result.isError || page >= pageCount} onClick={() => goToPage(page + 1)} aria-label={t('home.clients.next')} className="size-11 min-w-11 p-0 sm:h-9 sm:w-auto sm:min-w-9 sm:px-3"><span className="hidden sm:inline">{t('home.clients.next')}</span><img src="/assets/home/caret-right.svg" alt="" className="size-4 brightness-0 invert" /></PaginationButton></PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
    {selectedClient?.client.status === 'partner-review' && <ClientPartnerReviewModal client={selectedClient.client} gateway={gateway} returnFocusElement={selectedClient.opener} onClose={() => { setSelectedClient(null); window.requestAnimationFrame(() => { if (!selectedClient.opener?.isConnected) activeFilterRef.current?.focus() }) }} />}
    {selectedClient && (selectedClient.client.status === 'suspended' || selectedClient.client.status === 'overdue' || selectedClient.client.status === 'offboarding-pending') && <ClientPaymentModal client={selectedClient.client} returnFocusElement={selectedClient.opener} onClose={() => setSelectedClient(null)} />}
    </>
  )
}
