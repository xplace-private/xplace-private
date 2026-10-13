import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import type { TransactionsGateway } from './api/transactions-gateway'
import { TransactionsProvider, useTransactions } from './transactions-provider'

type TransactionsValue = ReturnType<typeof useTransactions>

const firstTransaction = {
  id: 'one',
  source: 'card' as const,
  type: 'card' as const,
  isCredit: false,
  merchant: 'First Merchant',
  details: '20 Aug · 09:41',
  amount: '−USD 10.00',
  amountCents: 1000,
  currency: 'USD',
  state: 'completed' as const,
  category: null,
  date: null,
  location: null,
  declineReasonCategory: null,
  card: '•••• 4242',
  rate: null,
}

const summary = {
  year: 2026,
  month: 8,
  transactionCount: 2,
  totalSpentCents: 1000,
  dueDate: '2026-09-05',
}

let value: TransactionsValue | null = null
let root: Root | null = null
let queryClient: QueryClient | null = null

function Probe({ enabled, refetchOnMount = false }: { enabled: boolean; refetchOnMount?: boolean }) {
  const transactions = useTransactions({ enabled, pageSize: 20, refetchOnMount })
  useEffect(() => {
    value = transactions
  }, [transactions])
  return null
}

function getValue(): TransactionsValue {
  if (value === null) throw new Error('Transactions value was not captured')
  return value
}

function container(): Element {
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
  }
  return {
    nodeType: 1,
    nodeName: 'DIV',
    tagName: 'DIV',
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Element
}

function render(gateway: TransactionsGateway, enabled: boolean, visible = true, refetchOnMount = false) {
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <TransactionsProvider gateway={gateway}>
          {visible ? <Probe enabled={enabled} refetchOnMount={refetchOnMount} /> : null}
        </TransactionsProvider>
      </QueryClientProvider>,
    )
  })
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
  }
  throw new Error('Transactions state did not settle')
}

function prepare() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as unknown as { window?: unknown }).window = { HTMLIFrameElement: class {} }
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  root = createRoot(container())
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  queryClient?.clear()
  value = null
  root = null
  queryClient = null
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT
  delete (globalThis as unknown as { window?: unknown }).window
})

test('waits for the session gate and appends the next private-feed page', async () => {
  prepare()
  let resolveSecond!: (value: Awaited<ReturnType<TransactionsGateway['list']>>) => void
  const list = vi
    .fn<TransactionsGateway['list']>()
    .mockResolvedValueOnce({
      ok: true,
      data: { count: 2, nextPage: 2, transactions: [firstTransaction], summary },
    })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
  const gateway: TransactionsGateway = { list }

  render(gateway, false)
  expect(getValue().status).toBe('idle')
  expect(list).not.toHaveBeenCalled()

  render(gateway, true)
  expect(getValue().status).toBe('loading')
  await waitFor(() => getValue().status === 'ready')
  expect(getValue()).toMatchObject({
    transactions: [firstTransaction],
    count: 2,
    summary,
    hasNextPage: true,
  })

  act(() => getValue().loadMore())
  await waitFor(() => getValue().isLoadingMore)
  await act(async () => {
    resolveSecond({
      ok: true,
      data: {
        count: 2,
        nextPage: null,
        transactions: [{ ...firstTransaction, id: 'two', merchant: 'Second Merchant' }],
        summary,
      },
    })
  })
  await waitFor(() => !getValue().isLoadingMore)

  expect(getValue().transactions.map((transaction) => transaction.id)).toEqual(['one', 'two'])
  expect(getValue().hasNextPage).toBe(false)
  expect(list).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, pageSize: 20 }))
  expect(list).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, pageSize: 20 }))
})

test('reuses the private-feed cache when the screen mounts again', async () => {
  prepare()
  const list = vi.fn<TransactionsGateway['list']>().mockResolvedValue({
    ok: true,
    data: { count: 1, nextPage: null, transactions: [firstTransaction], summary },
  })
  const gateway: TransactionsGateway = { list }

  render(gateway, true)
  await waitFor(() => getValue().status === 'ready')
  render(gateway, true, false)
  render(gateway, true)
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))

  expect(getValue().transactions).toEqual([firstTransaction])
  expect(list).toHaveBeenCalledTimes(1)
})

test.each([
  { transactions: [] },
  { transactions: [firstTransaction] },
])('refreshes cached transactions in the background: $transactions.length rows', async ({ transactions }) => {
  prepare()
  let resolveRefresh!: (result: Awaited<ReturnType<TransactionsGateway['list']>>) => void
  const list = vi.fn<TransactionsGateway['list']>()
    .mockResolvedValueOnce({
      ok: true,
      data: { count: transactions.length, nextPage: 2, transactions, summary },
    })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
  const gateway: TransactionsGateway = { list }

  render(gateway, true, true, true)
  await waitFor(() => getValue().status === 'ready')
  render(gateway, true, false, true)
  render(gateway, true, true, true)

  expect(list).toHaveBeenCalledTimes(2)
  expect(getValue()).toMatchObject({ status: 'ready', transactions, summary, isLoadingMore: false })
  act(() => getValue().loadMore())
  expect(list).toHaveBeenCalledTimes(2)

  const updated = { ...firstTransaction, id: 'updated', merchant: 'Updated Merchant' }
  await act(async () => resolveRefresh({
    ok: true,
    data: { count: 1, nextPage: null, transactions: [updated], summary },
  }))
  await waitFor(() => getValue().transactions[0]?.id === 'updated')
  expect(getValue().status).toBe('ready')
  expect(list).toHaveBeenCalledTimes(2)

  list.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
  render(gateway, true, false, true)
  render(gateway, true, true, true)
  expect(getValue()).toMatchObject({ status: 'ready', transactions: [updated] })
  await act(async () => resolveRefresh({
    ok: false,
    code: 'transactions-failed',
    message: 'Unable to load transactions. Try again.',
  }))
  await waitFor(() => getValue().error !== null)
  expect(getValue()).toMatchObject({ status: 'ready', transactions: [updated] })

  list.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
  act(() => getValue().retry())
  expect(getValue()).toMatchObject({ status: 'ready', transactions: [updated] })
  await act(async () => resolveRefresh({
    ok: true,
    data: { count: 0, nextPage: null, transactions: [], summary },
  }))
  await waitFor(() => getValue().error === null && getValue().transactions.length === 0)
  expect(getValue().status).toBe('ready')
})

test('loads the next page after an unchanged background refresh', async () => {
  prepare()
  const firstPage = {
    count: 2,
    nextPage: 2,
    transactions: [firstTransaction],
    summary,
  }
  let resolveRefresh!: (result: Awaited<ReturnType<TransactionsGateway['list']>>) => void
  const list = vi.fn<TransactionsGateway['list']>()
    .mockResolvedValueOnce({ ok: true, data: firstPage })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
    .mockResolvedValueOnce({
      ok: true,
      data: {
        ...firstPage,
        nextPage: null,
        transactions: [{ ...firstTransaction, id: 'two' }],
      },
    })

  render({ list }, true)
  await waitFor(() => getValue().status === 'ready')
  render({ list }, true, false, true)
  render({ list }, true, true, true)
  await waitFor(() => list.mock.calls.length === 2)
  await act(async () => resolveRefresh({ ok: true, data: firstPage }))
  await waitFor(() => queryClient?.isFetching() === 0)
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
  expect(getValue()).toMatchObject({ hasNextPage: true, isLoadingMore: false })

  act(() => getValue().loadMore())
  await waitFor(() => list.mock.calls.length === 3)
  await waitFor(() => getValue().transactions.length === 2)
  expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
})

test('refetches only the first page when a paginated feed mounts again', async () => {
  prepare()
  const list = vi.fn<TransactionsGateway['list']>().mockImplementation((input) =>
    Promise.resolve({
      ok: true,
      data: {
        count: 60,
        nextPage: input.page < 3 ? input.page + 1 : null,
        transactions: [{ ...firstTransaction, id: `transaction-${input.page}` }],
        summary,
      },
    }),
  )
  const gateway: TransactionsGateway = { list }

  render(gateway, true, true, true)
  await waitFor(() => getValue().status === 'ready')
  act(() => getValue().loadMore())
  await waitFor(() => getValue().transactions.length === 2)
  act(() => getValue().loadMore())
  await waitFor(() => getValue().transactions.length === 3)

  render(gateway, true, false, true)
  render(gateway, true, true, true)
  await waitFor(() => getValue().status === 'ready')

  expect(list).toHaveBeenCalledTimes(4)
  expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  expect(getValue().transactions).toHaveLength(1)
})

test('keeps loaded rows visible when the next page fails and retries that page', async () => {
  prepare()
  const list = vi
    .fn<TransactionsGateway['list']>()
    .mockResolvedValueOnce({
      ok: true,
      data: { count: 2, nextPage: 2, transactions: [firstTransaction], summary },
    })
    .mockResolvedValueOnce({
      ok: false,
      code: 'transactions-failed',
      message: 'Unable to load transactions. Try again.',
    })
    .mockResolvedValueOnce({
      ok: true,
      data: {
        count: 2,
        nextPage: null,
        transactions: [{ ...firstTransaction, id: 'two' }],
        summary,
      },
    })
  const gateway: TransactionsGateway = { list }

  render(gateway, true)
  await waitFor(() => getValue().status === 'ready')
  act(() => getValue().loadMore())
  await waitFor(() => getValue().error !== null)
  expect(getValue()).toMatchObject({
    status: 'ready',
    transactions: [firstTransaction],
    error: 'Unable to load transactions. Try again.',
  })

  act(() => getValue().retry())
  await waitFor(() => getValue().transactions.length === 2)
  expect(list).toHaveBeenCalledTimes(3)
})
