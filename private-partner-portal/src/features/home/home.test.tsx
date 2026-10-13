import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'

import { clientStatuses, type ClientsQuery, type HomeGateway } from './api/home-gateway'
import { mockHomeGateway } from './api/mock-home-gateway'
import { HomeChart } from './home-chart'
import { HomeScreen } from './home-screen'
import { clientsQuery, overviewQuery } from './home-queries'

const initial: ClientsQuery = { search: '', status: 'all', page: 1, pageSize: 10 }
const signal = () => new AbortController().signal
async function response<T>(pending: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(450)
  return pending
}
afterEach(() => vi.useRealTimers())

test('loads the Figma overview and 47 unique records across bounded pages', async () => {
  vi.useFakeTimers()
  const overview = await response(mockHomeGateway.getOverview(signal()))
  expect(overview).toMatchObject({ partnerName: 'Valkyrie Global Ltd', spend: 2_847_392, commission: 142_369, activeClients: 12 })
  expect(overview.monthly).toHaveLength(12)
  const ids: string[] = []
  for (let page = 1; page <= 5; page++) {
    const result = await response(mockHomeGateway.getClients({ ...initial, page }, signal()))
    expect(result.total).toBe(47)
    expect(result.items).toHaveLength(page === 5 ? 7 : 10)
    expect(result.counts).toMatchObject({ all: 47, active: 12, overdue: 1, suspended: 2 })
    expect(clientStatuses.reduce((sum, status) => sum + Number(result.counts[status]), 0)).toBe(result.counts.all)
    ids.push(...result.items.map((client) => client.id))
  }
  expect(new Set(ids).size).toBe(47)
  expect((await response(mockHomeGateway.getClients({ ...initial, page: 999 }, signal()))).page).toBe(5)
  expect((await response(mockHomeGateway.getClients({ ...initial, page: -3, pageSize: NaN }, signal()))).page).toBe(1)
})

test('searches trimmed case-insensitive names, emails and unformatted phone numbers', async () => {
  vi.useFakeTimers()
  for (const search of ['  EMILY CARTER ', 'krypton@labs.io', '15553334444']) {
    const result = await response(mockHomeGateway.getClients({ ...initial, search }, signal()))
    expect(result.total).toBe(1)
    expect(result.items[0]?.name).toBe('Emily Carter')
  }
  const result = await response(mockHomeGateway.getClients({ ...initial, search: 'David', status: 'suspended' }, signal()))
  expect(result.total).toBe(1)
  expect(result.counts.all).toBe(5)
  expect(result.items[0]?.status).toBe('suspended')
  const empty = await response(mockHomeGateway.getClients({ ...initial, search: 'no-such-client', page: 6 }, signal()))
  expect(empty).toMatchObject({ items: [], total: 0, page: 1 })
  expect(Object.values(empty.counts).every((count) => count === 0)).toBe(true)
})

test('supports every status and isolates returned records from the mock store', async () => {
  vi.useFakeTimers()
  for (const status of clientStatuses) {
    const result = await response(mockHomeGateway.getClients({ ...initial, status }, signal()))
    expect(result.total).toBe(result.counts[status])
    expect(result.items.every((client) => client.status === status)).toBe(true)
  }
  const first = await response(mockHomeGateway.getClients(initial, signal()))
  first.items[0]!.name = 'Changed by caller'
  expect((await response(mockHomeGateway.getClients(initial, signal()))).items[0]?.name).toBe('David Mitchell')
})

test('payment details belong to relevant client fixtures and preserve unknown and zero values', async () => {
  vi.useFakeTimers()
  const query = { ...initial, pageSize: 100 }
  const clients = (await response(mockHomeGateway.getClients(query, signal()))).items
  for (const client of clients) {
    expect(client.paymentDetails !== null).toBe(client.status === 'suspended' || client.status === 'overdue' || client.id === 'client-3')
  }
  expect(clients.find((client) => client.id === 'client-1')?.paymentDetails).toEqual({
    source: 'mock', currency: 'USD', statementOwed: 499.88, dueDate: '2026-09-05', unpaidBalance: 3084.90,
    amountToPay: 3084.90, suspensionDate: '2026-09-09', balanceAsOf: null, monthlyLateFeePercent: 2.99,
    minimumLateFee: 50,
    bankRails: [
      { type: 'swift', currency: 'USD', thirdPartyAllowed: null, fields: [
        { name: 'accountName', value: 'Name Client' }, { name: 'bank', value: 'Emirates NBD' },
        { name: 'iban', value: 'AE070331234567890123456' }, { name: 'swift', value: 'EBILEAD' },
      ] },
      { type: 'sepa', currency: 'EUR', thirdPartyAllowed: null, fields: [
        { name: 'identity', value: 'Pontech Group L.L.C-FZ' }, { name: 'bank', value: 'Emirates NBD' },
        { name: 'iban', value: '110987654321' }, { name: 'bic', value: 'SP29NWBK60161331926819' }, { name: 'reference', value: 'XP-4417-8825' },
      ] },
    ],
    eur: { usdRate: 0.8807, statementOwed: 440.24 },
    crypto: { depositAddress: 'So1aNaXP1cePr1vAteDemo7yqW3kZ9mDepos7ADDRnotreal' },
    proofEmail: 'example@gmail.com',
  })
  expect(clients.find((client) => client.id === 'client-2')?.paymentDetails).toEqual(clients[0]?.paymentDetails)
  expect(clients.find((client) => client.id === 'client-3')).toMatchObject({ closedAt: '2026-09-12', paymentDetails: { unpaidBalance: 3084.90, balanceAsOf: '2026-09-29' } })
  expect(clients.find((client) => client.id === 'client-9')?.closedAt).toBe('2026-09-12')
  expect(clients.some((client) => client.status === 'closed' && client.closedAt === null)).toBe(true)
  const secondSuspended = clients.find((client) => client.id === 'client-21')?.paymentDetails
  expect(secondSuspended).toMatchObject({ statementOwed: 0, dueDate: null, unpaidBalance: null, amountToPay: null, monthlyLateFeePercent: 0, minimumLateFee: 0 })
  expect(secondSuspended?.bankRails).toEqual([])
  expect(secondSuspended?.proofEmail).toBeNull()
  expect(secondSuspended?.eur).toBeNull()
  expect(secondSuspended?.crypto).toBeNull()

  clients[0]!.paymentDetails!.bankRails[0]!.fields[0]!.value = 'Changed by caller'
  expect((await response(mockHomeGateway.getClients(query, signal()))).items[0]?.paymentDetails?.bankRails[0]?.fields[0]?.value).toBe('Name Client')
})

test('cancels pending and already-aborted reads without leaving timers behind', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const pending = mockHomeGateway.getClients(initial, controller.signal)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  await expect(mockHomeGateway.getOverview(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(vi.getTimerCount()).toBe(0)
})

test('changing the query cancels old reads and cannot replace a newer search result', async () => {
  vi.useFakeTimers()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const requests: AbortSignal[] = []
  const gateway: HomeGateway = {
    ...mockHomeGateway,
    getClients: (query, requestSignal) => {
      requests.push(requestSignal)
      return mockHomeGateway.getClients(query, requestSignal)
    },
  }
  const observer = new QueryObserver(client, clientsQuery(gateway, initial))
  const unsubscribe = observer.subscribe(() => {})
  const search = { ...initial, search: 'Emily' }
  observer.setOptions(clientsQuery(gateway, search))
  expect(requests[0]?.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(450)
  expect(observer.getCurrentResult().data?.items.map((item) => item.name)).toEqual(['Emily Carter'])
  expect(client.getQueryData(clientsQuery(gateway, initial).queryKey)).toBeUndefined()
  unsubscribe()
  client.clear()
})

test('clearing session queries aborts reads and prevents late data from reappearing', async () => {
  vi.useFakeTimers()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const pending = client.fetchQuery(overviewQuery(mockHomeGateway))
  const rejected = expect(pending).rejects.toThrow()
  client.removeQueries({ queryKey: ['home'] })
  await rejected
  await vi.advanceTimersByTimeAsync(1000)
  expect(client.getQueriesData({ queryKey: ['home'] })).toEqual([])
  client.clear()
})

test('the same query contract accepts another adapter, surfaces failures and retries', async () => {
  vi.useFakeTimers()
  const fixture = await response(mockHomeGateway.getOverview(signal()))
  const gateway: HomeGateway = {
    ...mockHomeGateway,
    getOverview: vi.fn<HomeGateway['getOverview']>().mockRejectedValueOnce(new Error('private server diagnostic')).mockResolvedValueOnce(fixture),
    getClients: vi.fn<HomeGateway['getClients']>().mockRejectedValue(new Error('unused')),
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await expect(client.fetchQuery(overviewQuery(gateway))).rejects.toThrow('private server diagnostic')
  expect(client.getQueryData(overviewQuery(gateway).queryKey)).toBeUndefined()
  expect(await client.fetchQuery(overviewQuery(gateway))).toEqual(fixture)
  expect(gateway.getClients).not.toHaveBeenCalled()
  client.clear()
})

test('renders skeleton rows before data and preserves explicit unknown and empty states', async () => {
  vi.useFakeTimers()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const render = (knownCompanyName?: string) => renderToString(<QueryClientProvider client={client}><HomeScreen gateway={mockHomeGateway} onSessionChanged={() => Promise.resolve()} knownCompanyName={knownCompanyName} signOut={<button>Log Out</button>} onProfile={() => undefined} onHome={() => undefined} /></QueryClientProvider>)
  const pending = render()
  expect(pending).not.toContain('Partner review')
  expect(pending).not.toContain('Offboarding pending')
  expect(pending).not.toContain('Contact support')
  expect(pending.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0]).toContain('animate-pulse')
  const pendingWithKnownCompany = render('Valkyrie Global Ltd')
  expect(pendingWithKnownCompany.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0]).not.toContain('animate-pulse')
  expect(pendingWithKnownCompany).toContain('Valkyrie Global Ltd')
  expect(pending.match(/data-client-skeleton="true"/g)).toHaveLength(10)
  expect(pending).not.toContain('vanguard@tech.co')
  const overview = await response(mockHomeGateway.getOverview(signal()))
  const empty = await response(mockHomeGateway.getClients({ ...initial, search: 'absent' }, signal()))
  client.setQueryData(overviewQuery(mockHomeGateway).queryKey, { ...overview, spend: null, monthly: [] })
  client.setQueryData(clientsQuery(mockHomeGateway, initial).queryKey, empty)
  const loaded = render()
  expect(loaded).toContain('No clients found.')
  expect(loaded).toContain('No monthly activity available.')
  expect(loaded).toContain('—')
  expect(loaded).not.toContain('NaN')
  expect(loaded).not.toContain('data-client-skeleton')
  const singleClient = await response(mockHomeGateway.getClients({ ...initial, search: 'Emily' }, signal()))
  client.setQueryData(clientsQuery(mockHomeGateway, initial).queryKey, singleClient)
  const tableBody = render().match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1]
  expect(tableBody?.match(/<tr\b/g)).toHaveLength(1)
  expect(tableBody).toContain('Emily Carter')
  const failed = renderToString(<HomeChart series="spend" overview={undefined} loading={false} error onRetry={() => {}} />)
  expect(failed).toContain('Unable to load your dashboard.')
  expect(failed).toContain('Try again')
  expect(failed).not.toContain('private server diagnostic')
  client.clear()
})

test('client failure stays inside its panel and never displays raw server diagnostics', async () => {
  vi.useFakeTimers()
  const overview = await response(mockHomeGateway.getOverview(signal()))
  const gateway: HomeGateway = { ...mockHomeGateway, getClients: async () => { throw new Error('private server diagnostic') } }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
  client.setQueryData(overviewQuery(gateway).queryKey, overview)
  await expect(client.fetchQuery(clientsQuery(gateway, initial))).rejects.toThrow('private server diagnostic')
  const html = renderToString(<QueryClientProvider client={client}><HomeScreen gateway={gateway} onSessionChanged={() => Promise.resolve()} signOut={<button>Log Out</button>} onProfile={() => undefined} onHome={() => undefined} /></QueryClientProvider>)
  expect(html).toContain('$2,847,392')
  expect(html).toContain('Unable to load clients.')
  expect(html).toContain('Try again')
  expect(html).not.toContain('private server diagnostic')
  client.clear()
})

test('each chart treats only its own missing series as empty and preserves zero values', async () => {
  vi.useFakeTimers()
  const overview = await response(mockHomeGateway.getOverview(signal()))
  overview.monthly = [{ month: 'Jan', spend: 0, commission: null }]
  const render = (series: 'spend' | 'commission') => renderToString(<HomeChart series={series} overview={overview} loading={false} error={false} onRetry={() => {}} />)
  expect(render('commission')).toContain('No monthly activity available.')
  expect(render('spend')).not.toContain('No monthly activity available.')
  expect(render('spend')).toContain('data-slot="chart"')
})


test('moves to the last available page when server records disappear', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const counts = { all: 1, active: 1, onboarding: 0, 'limit-review': 0, overdue: 0, suspended: 0 }
  const gateway: HomeGateway = { ...mockHomeGateway, getClients: vi.fn<HomeGateway['getClients']>().mockImplementation(async query => ({ items: [], total: 1, page: query.page, pageSize: query.pageSize, counts })) }
  expect((await client.fetchQuery(clientsQuery(gateway, { ...initial, page: 3 }))).page).toBe(1)
  expect(gateway.getClients).toHaveBeenCalledTimes(2)
  client.clear()
})
