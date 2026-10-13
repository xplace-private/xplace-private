import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { createReactDomTestContainer } from '../../shared/testing/react-dom-test-container'
import { usePhysicalCardOrder } from './use-physical-card-order'
import type { PhysicalCardGateway } from './api/http-physical-card-gateway'
import { PhysicalCardError } from './api/http-physical-card-gateway'
import type { PhysicalCardOrder } from './model/physical-card-order'

vi.mock('./card-notifications', () => ({ showCardIssuedToast: vi.fn() }))
import { showCardIssuedToast } from './card-notifications'

const country = { code: 'US' as const, name: 'United States', flag: '🇺🇸', phoneCode: '+1', postalCodeRegex: '^\\d{5}$' }
const address = { address: '1 Main St', apartment: '', city: 'New York', region: 'New York', postcode: '10001', country: 'US', phoneCountry: 'US', phone: '2025550123' }
const draft: PhysicalCardOrder = { id: 42, status: 'draft', cardId: null, price: '99.00', address }
let value: ReturnType<typeof usePhysicalCardOrder>
let root: Root
let client: QueryClient
function mount(overrides: Partial<PhysicalCardGateway> = {}, onIssued = vi.fn().mockResolvedValue(true)) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  const gateway: PhysicalCardGateway = {
    options: vi.fn().mockResolvedValue({ countries: [country], price: '99.00' }),
    latest: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(draft),
    pay: vi.fn().mockResolvedValue({ ...draft, status: 'paid' }), ...overrides,
  }
  const onPaid = vi.fn()
  function Probe({ sessionKey }: { sessionKey: string }) {
    const result = usePhysicalCardOrder({ gateway, recipient: { firstName: 'Jane', lastName: 'Doe' }, sessionKey, onIssued, onPaid })
    useEffect(() => { value = result }, [result])
    return null
  }
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  root = createRoot(createReactDomTestContainer())
  const switchSession = (sessionKey: string) => act(() => root.render(<QueryClientProvider client={client}><Probe sessionKey={sessionKey} /></QueryClientProvider>))
  switchSession('test')
  return { gateway, onIssued, onPaid, switchSession }
}
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) }) }
afterEach(() => { act(() => root?.unmount()); client?.clear(); focusManager.setFocused(undefined); vi.unstubAllGlobals(); vi.clearAllMocks() })

test.each([null, draft])('does not refresh the physical order when returning to the browser tab (%j)', async (order) => {
  const latest = vi.fn().mockResolvedValue(order)
  mount({ latest })
  await flush()
  await act(async () => { focusManager.setFocused(false) })
  await act(async () => { focusManager.setFocused(true) })
  await flush()
  expect(latest).toHaveBeenCalledTimes(1)
})

test('restores a draft, saves before payment, and prevents duplicate submissions', async () => {
  const { gateway } = mount()
  await flush()
  act(() => { void value.open('Travel') })
  await flush()
  expect(value.address).toEqual(address)
  await act(async () => { await Promise.all([value.submit(), value.submit()]) })
  expect(gateway.save).toHaveBeenCalledTimes(1)
  expect(gateway.pay).toHaveBeenCalledTimes(1)
  expect(vi.mocked(gateway.save).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(gateway.pay).mock.invocationCallOrder[0]!)
})

test.each([
  { order: null, expected: '0.01' },
  { order: { ...draft, price: '12.34' }, expected: '12.34' },
  { order: { ...draft, status: 'pending_payment', price: '56.78' }, expected: '56.78' },
  { order: { ...draft, price: null }, expected: null },
] as const)('uses the current order fee or Silver tariff for a new order: $expected', async ({ order, expected }) => {
  mount({
    latest: vi.fn().mockResolvedValue(order),
    options: vi.fn().mockResolvedValue({ countries: [country], price: '0.01' }),
  })
  await flush()
  await act(async () => { await value.open('Travel') })
  expect(value.price).toBe(expected)
})

test('keeps fields on payment rejection and does not pay if draft saving fails', async () => {
  const { gateway } = mount({ save: vi.fn().mockRejectedValue(new PhysicalCardError()) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  await act(async () => value.submit())
  expect(gateway.pay).not.toHaveBeenCalled()
  expect(value.address).toEqual(address)
  expect(value.error).toBe('home.delivery.errors.request')
})

test('closing while issuing still refreshes cards and toasts once', async () => {
  const latest = vi.fn().mockResolvedValue(draft)
  const { onIssued } = mount({ latest })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  latest.mockResolvedValue({ ...draft, status: 'paid' })
  await act(async () => value.submit())
  act(() => value.close())
  expect(value.isOpen).toBe(false)
  latest.mockResolvedValue({ ...draft, status: 'issued', cardId: 77 })
  await act(async () => value.retry())
  await flush()
  expect(onIssued).toHaveBeenCalledWith(77, 'Travel', expect.any(AbortSignal))
  expect(showCardIssuedToast).toHaveBeenCalledTimes(1)
  await act(async () => value.retry()); await flush()
  expect(showCardIssuedToast).toHaveBeenCalledTimes(1)
})

test('closing an incomplete form retains its fields without creating a server draft', async () => {
  const { gateway } = mount({ latest: vi.fn().mockResolvedValue(null) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  act(() => value.change('city', 'London'))
  act(() => value.close()); await flush()
  act(() => { void value.open('Travel') }); await flush()
  expect(value.address.city).toBe('London')
  expect(gateway.save).not.toHaveBeenCalled()
  expect(gateway.pay).not.toHaveBeenCalled()
})

test('keeps checking an uncertain payment result instead of allowing another payment', async () => {
  const latest = vi.fn().mockResolvedValue(draft)
  const { gateway } = mount({ latest, pay: vi.fn().mockRejectedValue(new PhysicalCardError()) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  latest.mockResolvedValueOnce(draft).mockRejectedValueOnce(new PhysicalCardError())
  await act(async () => value.submit())
  expect(value.phase).toBe('waiting')
  expect(value.canRetry).toBe(true)
  await act(async () => value.submit())
  expect(gateway.pay).toHaveBeenCalledTimes(1)
  latest.mockResolvedValue({ ...draft, status: 'issued', cardId: 77 })
  await act(async () => value.retry()); await flush()
  expect(showCardIssuedToast).toHaveBeenCalledTimes(1)
})

test('restores a paid order after reload and completes without another save or payment', async () => {
  const latest = vi.fn().mockResolvedValue({ ...draft, status: 'paid' })
  const { gateway, onIssued } = mount({ latest })
  await flush()
  expect(value.phase).toBe('waiting')
  latest.mockResolvedValue({ ...draft, status: 'issued', cardId: 77 })
  await act(async () => value.retry()); await flush()
  expect(onIssued).toHaveBeenCalledTimes(1)
  expect(gateway.save).not.toHaveBeenCalled()
  expect(gateway.pay).not.toHaveBeenCalled()
})

test('does not treat an old issued card as a newly completed order', async () => {
  const { onIssued } = mount({ latest: vi.fn().mockResolvedValue({ ...draft, status: 'issued', cardId: 77 }) })
  await flush()
  expect(onIssued).not.toHaveBeenCalled()
  expect(showCardIssuedToast).not.toHaveBeenCalled()
})

test('retains the address and allows retry after a definitive payment rejection', async () => {
  const { gateway } = mount({ pay: vi.fn().mockRejectedValue(new PhysicalCardError('home.delivery.errors.balance')) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  await act(async () => value.submit())
  expect(value.phase).toBe('editing')
  expect(value.error).toBe('home.delivery.errors.balance')
  expect(value.canRetry).toBe(false)
  expect(value.address).toEqual(address)
  expect(gateway.pay).toHaveBeenCalledTimes(1)
})

test('saves a complete form on close without paying', async () => {
  const { gateway } = mount()
  await flush(); act(() => { void value.open('Travel') }); await flush()
  act(() => value.close()); await flush()
  expect(value.isOpen).toBe(false)
  expect(gateway.save).toHaveBeenCalledTimes(1)
  expect(gateway.pay).not.toHaveBeenCalled()
})

test('a late payment response cannot affect another session', async () => {
  let finish: (order: PhysicalCardOrder) => void = () => {}
  const pay = vi.fn(() => new Promise<PhysicalCardOrder>((resolve) => { finish = resolve }))
  const latest = vi.fn().mockResolvedValue(draft)
  const { switchSession, onPaid } = mount({ latest, pay })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  let submission: Promise<void> = Promise.resolve()
  act(() => { submission = value.submit() }); await flush()
  expect(pay).toHaveBeenCalledTimes(1)
  latest.mockResolvedValue(null)
  switchSession('another-user'); await flush()
  await act(async () => { finish({ ...draft, status: 'paid' }); await submission })
  expect(value.phase).toBe('editing')
  expect(value.address.address).toBe('')
  expect(onPaid).not.toHaveBeenCalled()
  expect(showCardIssuedToast).not.toHaveBeenCalled()
})

test('restores the pending nickname when issuance finished while the page was reloading', async () => {
  const storage = new Map([['physical-order:test', JSON.stringify({ id: 42, name: 'Travel' })]])
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  const { onIssued } = mount({ latest: vi.fn().mockResolvedValue({ ...draft, status: 'issued', cardId: 77 }) })
  await flush()
  expect(onIssued).toHaveBeenCalledWith(77, 'Travel', expect.any(AbortSignal))
  expect(showCardIssuedToast).toHaveBeenCalledTimes(1)
  expect(storage.size).toBe(0)
})

test('continues watching when a restored issued order cannot refresh its card yet', async () => {
  vi.stubGlobal('sessionStorage', { getItem: () => JSON.stringify({ id: 42, name: 'Travel' }), setItem: vi.fn(), removeItem: vi.fn() })
  const onIssued = vi.fn().mockRejectedValueOnce(new Error('list temporarily unavailable')).mockResolvedValue(true)
  mount({ latest: vi.fn().mockResolvedValue({ ...draft, status: 'issued', cardId: 77 }) }, onIssued)
  await flush()
  expect(value.phase).toBe('waiting')
  expect(value.error).toBe('home.delivery.errors.refresh')
  await act(async () => value.retry()); await flush()
  expect(onIssued).toHaveBeenCalledTimes(2)
  expect(showCardIssuedToast).toHaveBeenCalledTimes(1)
})

test('keeps a pending-payment address read-only and retries payment on that same order', async () => {
  const { gateway } = mount({ latest: vi.fn().mockResolvedValue({ ...draft, status: 'pending_payment' }) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  expect(value.addressLocked).toBe(true)
  act(() => value.change('city', 'Another city'))
  expect(value.address.city).toBe('New York')
  await act(async () => value.submit())
  expect(gateway.save).not.toHaveBeenCalled()
  expect(gateway.pay).toHaveBeenCalledWith(42, expect.any(AbortSignal))
})

test('lets the backend decide whether a new order is allowed after a failed order', async () => {
  const { gateway } = mount({ latest: vi.fn().mockResolvedValue({ ...draft, status: 'failed' }) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  for (const [field, text] of Object.entries(address)) act(() => value.change(field as keyof typeof address, text))
  await act(async () => value.submit())
  expect(gateway.save).toHaveBeenCalledWith(null, expect.anything(), expect.anything(), expect.any(AbortSignal))
  expect(gateway.pay).toHaveBeenCalledTimes(1)
})

test('defaults a new phone country to US and preserves the user selection on reopening', async () => {
  mount({ latest: vi.fn().mockResolvedValue(null) })
  await flush(); act(() => { void value.open('Travel') }); await flush()
  expect(value.address.phoneCountry).toBe('US')
  act(() => value.change('phoneCountry', 'AE'))
  act(() => value.close()); act(() => { void value.open('Travel') }); await flush()
  expect(value.address.phoneCountry).toBe('AE')
})

test('opens delivery only after countries finish loading', async () => {
  let finish!: (data: { countries: typeof country[]; price: string }) => void
  const options = vi.fn(() => new Promise<{ countries: typeof country[]; price: string }>((resolve) => { finish = resolve }))
  mount({ options })
  await flush()
  let opening: unknown
  act(() => { opening = value.open('Travel') })
  await flush()
  expect(options).toHaveBeenCalledTimes(1)
  expect(value.isOpen).toBe(false)
  await act(async () => { finish({ countries: [country], price: '99.00' }); await opening })
  expect(value.isOpen).toBe(true)
  expect(value.loading).toBe(false)
})

test('keeps delivery closed when loading countries fails and allows retry', async () => {
  const options = vi.fn().mockRejectedValueOnce(new PhysicalCardError()).mockResolvedValue({ countries: [country], price: '99.00' })
  mount({ options }); await flush()
  await act(async () => { await value.open('Travel') })
  expect(value.isOpen).toBe(false)
  await act(async () => { await value.open('Travel') })
  expect(value.isOpen).toBe(true)
})
