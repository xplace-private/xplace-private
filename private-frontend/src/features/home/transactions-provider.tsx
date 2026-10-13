import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'

import type { TransactionsGateway } from './api/transactions-gateway'
import type { Transaction, TransactionsPage, TransactionSummary } from './model/transaction'
import {
  TRANSACTIONS_QUERY_KEY,
  TransactionsQueryError,
  transactionsInfiniteQueryOptions,
} from './transactions-query'

interface TransactionsProviderProps {
  gateway: TransactionsGateway
  children: ReactNode
}

interface UseTransactionsInput {
  enabled: boolean
  pageSize: number
  period?: { year: number; month: number }
  refetchOnMount?: boolean
}

type TransactionsStatus = 'idle' | 'loading' | 'ready' | 'error'

interface TransactionsValue {
  status: TransactionsStatus
  transactions: readonly Transaction[]
  count: number
  summary: TransactionSummary | null
  error: string | null
  hasNextPage: boolean
  isLoadingMore: boolean
  retry(): void
  loadMore(): void
  resetSession(): void
}

const TransactionsContext = createContext<TransactionsGateway | null>(null)

export function TransactionsProvider({ gateway, children }: TransactionsProviderProps) {
  return <TransactionsContext value={gateway}>{children}</TransactionsContext>
}

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export function useTransactions({
  enabled,
  pageSize,
  period,
  refetchOnMount = true,
}: UseTransactionsInput): TransactionsValue {
  const gateway = useContext(TransactionsContext)
  if (gateway === null) throw new Error('useTransactions must be used within TransactionsProvider')
  const queryClient = useQueryClient()
  const queryOptions = useMemo(
    () =>
      transactionsInfiniteQueryOptions(gateway, {
        pageSize,
        ...(period === undefined ? {} : { period }),
      }),
    [gateway, pageSize, period],
  )
  const queryKey = queryOptions.queryKey
  const query = useInfiniteQuery({
    ...queryOptions,
    enabled,
    refetchOnMount: refetchOnMount ? 'always' : false,
  })
  useEffect(() => {
    if (!enabled) return

    return () => {
      const data = queryClient.getQueryData<InfiniteData<TransactionsPage, number>>(queryKey)
      if (data === undefined || data.pages.length <= 1) return

      queryClient.setQueryData<InfiniteData<TransactionsPage, number>>(queryKey, {
        pages: data.pages.slice(0, 1),
        pageParams: data.pageParams.slice(0, 1),
      })
    }
  }, [enabled, queryClient, queryKey])
  const pages = query.data?.pages ?? []
  const status: TransactionsStatus = !enabled
    ? 'idle'
    : query.isPending
      ? 'loading'
      : query.isError && pages.length === 0
        ? 'error'
        : 'ready'
  const firstPage = pages[0]
  const retry = useCallback(() => {
    if (query.isFetchNextPageError) void query.fetchNextPage()
    else void query.refetch()
  }, [query])
  const { fetchNextPage, hasNextPage, isFetching } = query
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetching])
  const resetSession = useCallback(() => {
    void queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
    queryClient.removeQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
  }, [queryClient])

  return {
    status,
    transactions: pages.flatMap((page) => page.transactions),
    count: firstPage?.count ?? 0,
    summary: firstPage?.summary ?? null,
    error:
      query.isError
        ? query.error instanceof TransactionsQueryError
          ? query.error.message
          : 'Unable to load transactions. Try again.'
        : null,
    hasNextPage: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    retry,
    loadMore,
    resetSession,
  }
}
