import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useReducer } from 'react'
import { toast } from 'sonner'
import { appI18n } from '../../shared/i18n/app-i18n'
import { formatPhoneInput } from '../../shared/phone/phone-countries'
import { PhysicalCardError, type PhysicalCardGateway } from './api/http-physical-card-gateway'
import { showCardIssuedToast } from './card-notifications'
import { deliveryPhoneCountries, deliveryErrors, emptyPhysicalAddress, type CardRecipient, type DeliveryErrors, type PhysicalCardOrder, type PhysicalDeliveryAddress } from './model/physical-card-order'

export const PHYSICAL_ORDERS_QUERY_KEY = ['home', 'physical-orders'] as const
interface Input {
  gateway: PhysicalCardGateway
  enabled?: boolean
  recipient: CardRecipient
  sessionKey: string
  onIssued(cardId: number, name: string | null, signal: AbortSignal): Promise<boolean>
  onPaid(): void
}

interface FlowState {
  isOpen: boolean
  address: PhysicalDeliveryAddress
  name: string
  phase: 'editing' | 'saving' | 'paying' | 'waiting'
  error: string | null
  fields: DeliveryErrors
  watching: boolean
}
const initialState: FlowState = {
  isOpen: false, address: emptyPhysicalAddress, name: '', phase: 'editing', error: null, fields: {}, watching: false,
}

// Only the pending order's UI nickname is persisted; shipping details stay on the server.
function readPending(key: string): { id: number; name: string } | null {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (typeof data === 'object' && data !== null && 'id' in data && 'name' in data &&
        typeof data.id === 'number' && Number.isSafeInteger(data.id) && typeof data.name === 'string') return { id: data.id, name: data.name }
  } catch { /* Storage is optional in restricted WebViews. */ }
  return null
}

export function usePhysicalCardOrder({ gateway, recipient, sessionKey, onIssued, onPaid, enabled = true }: Input) {
  const client = useQueryClient()
  const queryKey = [...PHYSICAL_ORDERS_QUERY_KEY, sessionKey]
  const storageKey = `physical-order:${sessionKey}`
  const pending = useRef<ReturnType<typeof readPending>>(null)
  const [{ isOpen, address, name, phase, error, fields, watching }, update] = useReducer(
    (state: FlowState, patch: Partial<FlowState>) => ({ ...state, ...patch }), initialState,
  )
  const uncertainSince = useRef(Infinity)
  const mutation = useRef(false)
  const finishing = useRef(false)
  const dirty = useRef(false)
  const controller = useRef(new AbortController())
  const completed = useRef(new Set<number>())
  useLayoutEffect(() => {
    const lifecycle = new AbortController()
    controller.current = lifecycle
    pending.current = readPending(storageKey)
    completed.current.clear()
    dirty.current = false
    mutation.current = false
    finishing.current = false
    uncertainSince.current = Infinity
    update({ ...initialState, name: pending.current?.name ?? '' })
    return () => lifecycle.abort()
  }, [storageKey])
  const options = useQuery({
    queryKey: [...PHYSICAL_ORDERS_QUERY_KEY, 'options'],
    queryFn: ({ signal }) => gateway.options(signal), enabled: enabled && isOpen, staleTime: 60_000, retry: false,
  })
  const orders = useQuery({
    queryKey, queryFn: ({ signal }) => gateway.latest(signal), retry: false, enabled,
    refetchInterval: (query) => watching || query.state.data?.status === 'paid' ? 3000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, refetchOnReconnect: true,
  })

  function remember(order: PhysicalCardOrder, orderName: string) {
    pending.current = { id: order.id, name: orderName }
    try { sessionStorage.setItem(storageKey, JSON.stringify(pending.current)) } catch { /* Optional storage. */ }
  }
  function forget() {
    pending.current = null
    try { sessionStorage.removeItem(storageKey) } catch { /* Optional storage. */ }
  }
  function report(failure: unknown) {
    const known = failure instanceof PhysicalCardError ? failure : new PhysicalCardError()
    update({ error: known.message, fields: known.fields })
  }
  function accept(order: PhysicalCardOrder) {
    client.setQueryData(queryKey, order)
    if (order.status === 'paid' || order.status === 'issued') {
      update({ watching: true, phase: 'waiting' })
      onPaid()
    }
  }

  // Server polling advances the modal independently of user edits, including after it closes.
  useEffect(() => {
    const order = orders.data
    if (!order || mutation.current) return
    if (order.status === 'draft' || order.status === 'pending_payment') {
      if (!dirty.current) update({ address: order.address })
      if (watching && phase === 'waiting' && orders.dataUpdatedAt > uncertainSince.current) {
        update({ phase: 'editing', watching: false, error: 'home.delivery.errors.request' })
      }
      return
    }
    if (order.status === 'paid') {
      if (!pending.current || pending.current.id !== order.id) remember(order, '')
      update({ watching: true, phase: 'waiting' })
      return
    }
    const expected = pending.current?.id === order.id
    if ((order.status === 'failed' || order.status === 'canceled') && expected) {
      update({ watching: false, phase: 'editing', error: 'home.delivery.errors.failed' })
      if (!completed.current.has(order.id)) {
        completed.current.add(order.id)
        toast.error(appI18n.t('home.delivery.errors.failed'))
      }
      return
    }
    if (order.status !== 'issued' || order.cardId === null || !expected || completed.current.has(order.id) || finishing.current) return
    finishing.current = true
    update({ phase: 'waiting', watching: true })
    const signal = controller.current.signal
    void onIssued(order.cardId, pending.current?.name || null, signal).then((renamed) => {
      if (signal.aborted) return
      completed.current.add(order.id)
      forget()
      update(initialState)
      dirty.current = false
      showCardIssuedToast()
      if (!renamed) toast.error(appI18n.t('home.delivery.errors.rename'))
      onPaid()
    }).catch(() => {
      if (!signal.aborted) update({ error: 'home.delivery.errors.refresh' })
    }).finally(() => { if (signal === controller.current.signal) finishing.current = false })
  // Each fresh server response may advance an order even when its ID is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.data, orders.dataUpdatedAt, onIssued, onPaid])

  async function open(orderName: string, signal?: AbortSignal) {
    const lifecycle = controller.current.signal
    const [metadata, latest] = await Promise.all([options.refetch(), orders.refetch()])
    if (lifecycle.aborted || signal?.aborted || metadata.isError || latest.isError) return false
    update({ name: orderName, isOpen: true, fields: {} })
    return true
  }
  function change(field: keyof PhysicalDeliveryAddress, value: string) {
    if (orders.data?.status === 'pending_payment') return
    dirty.current = true
    const next = { ...address, [field]: value }
    const country = deliveryPhoneCountries(options.data?.countries ?? []).find((item) => item.code === next.phoneCountry)
    if (country && (field === 'phone' || field === 'phoneCountry')) next.phone = formatPhoneInput(country, next.phone)
    const nextFields = { ...fields }
    delete nextFields[field]
    update({ address: next, fields: nextFields })
  }
  async function save(pay: boolean) {
    if (mutation.current || phase === 'waiting') return
    if (!options.data) { update({ error: 'home.delivery.errors.request' }); return }
    const invalid = deliveryErrors(address, options.data.countries)
    update({ fields: invalid })
    if (Object.keys(invalid).length > 0) return
    mutation.current = true
    update({ error: null, phase: 'saving' })
    const signal = controller.current.signal
    let paying = false
    try {
      // Resolve a previous uncertain request before deciding to create or charge anything.
      const latest = await gateway.latest(signal)
      if (signal.aborted) return
      if (latest && (latest.status === 'paid' || latest.status === 'issued') &&
          (latest.status === 'paid' || pending.current?.id === latest.id)) {
        remember(latest, name)
        accept(latest)
        return
      }
      const order = latest?.status === 'pending_payment' ? latest : await gateway.save(latest?.status === 'draft' ? latest.id : null, address, recipient, signal)
      if (signal.aborted) return
      remember(order, name)
      client.setQueryData(queryKey, order)
      if (!pay) { update({ phase: 'editing' }); return }
      paying = true
      update({ phase: 'paying' })
      const paid = await gateway.pay(order.id, signal)
      if (signal.aborted) return
      accept(paid)
    } catch (failure) {
      if (signal.aborted) return
      if (paying) {
        try {
          const latest = await gateway.latest(signal)
          if (signal.aborted) return
          if (latest && (latest.status === 'paid' || latest.status === 'issued')) { accept(latest); return }
        } catch {
          if (signal.aborted) return
          uncertainSince.current = Date.now()
          update({ watching: true, phase: 'waiting', error: 'home.delivery.errors.checking' })
          return
        }
      }
      report(failure)
      update({ phase: 'editing' })
      if (!pay) toast.error(appI18n.t('home.delivery.errors.save'))
    } finally { if (signal === controller.current.signal) mutation.current = false }
  }
  function close() {
    update({ isOpen: false })
    if (phase === 'editing' && options.data && !Object.keys(deliveryErrors(address, options.data.countries)).length) void save(false)
  }
  async function retry() { await Promise.all([orders.refetch(), options.refetch()]) }
  return {
    isOpen, address, name, phase, error: error ?? (options.isError || orders.isError ? 'home.delivery.errors.request' : null), fields,
    countries: options.data?.countries ?? [], price: orders.data?.status === 'draft' || orders.data?.status === 'pending_payment' ? orders.data.price : options.data?.price ?? null,
    addressLocked: orders.data?.status === 'pending_payment',
    loading: options.isPending || orders.isPending,
    canRetry: options.isError || orders.isError || error === 'home.delivery.errors.refresh' || error === 'home.delivery.errors.checking',
    open, close, change, submit: () => save(true), retry,
  }
}

export type PhysicalCardFlow = ReturnType<typeof usePhysicalCardOrder>
