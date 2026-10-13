import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import {
  isDepositPending,
  isDepositReady,
  isCryptoDepositReady,
  type BankDeposit,
  type CryptoInstructions,
  type DepositChannels,
  type DepositsGateway,
} from './api/deposits-gateway'

export const DEPOSITS_QUERY_KEY = ['payment', 'deposits'] as const
const WAIT_LIMIT_MS = 120_000
const POLL_INTERVAL_MS = 5_000

export interface BankDepositsState {
  status: 'loading' | 'ready' | 'timed-out' | 'unavailable'
  deposits: readonly BankDeposit[]
}

export interface CryptoDepositsState {
  status: 'loading' | 'ready' | 'timed-out'
  details: CryptoInstructions | null
}

function needsPolling(deposits: DepositChannels | undefined) {
  return !deposits?.bank.some(isDepositReady) ||
    !deposits.crypto.some(isCryptoDepositReady)
}

export function useDeposits(gateway: DepositsGateway) {
  const client = useQueryClient()
  const [deadline] = useState(() => Date.now() + WAIT_LIMIT_MS)
  const [timedOut, setTimedOut] = useState(false)
  const query = useQuery({
    queryKey: DEPOSITS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const result = await gateway.list(signal)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    enabled: !timedOut,
    retry: false,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) =>
      !timedOut && needsPolling(query.state.data)
        ? POLL_INTERVAL_MS
        : false,
  })
  const waiting = !timedOut && needsPolling(query.data)

  useEffect(() => {
    if (!waiting) return
    const timeout = setTimeout(() => {
      setTimedOut(true)
      void client.cancelQueries({ queryKey: DEPOSITS_QUERY_KEY })
    }, Math.max(0, deadline - Date.now()))
    return () => clearTimeout(timeout)
  }, [client, deadline, waiting])

  const bankState = (currency: 'usd' | 'eur'): BankDepositsState => {
    const channels = (query.data?.bank ?? []).filter((deposit) =>
      currency === 'eur' ? deposit.sourceCurrency === 'eur' : deposit.sourceCurrency !== 'eur',
    )
    const deposits = channels.filter(isDepositReady)
    const status = deposits.length > 0
      ? 'ready'
      : timedOut
        ? 'timed-out'
        : !channels.length || channels.some(isDepositPending) ? 'loading' : 'unavailable'
    return { status, deposits }
  }
  const cryptoDetails = query.data?.crypto.find(isCryptoDepositReady)?.instructions ?? null
  const cryptoStatus: CryptoDepositsState['status'] = cryptoDetails !== null
    ? 'ready'
    : timedOut ? 'timed-out' : 'loading'

  return {
    bank: bankState('usd'),
    eur: bankState('eur'),
    crypto: { status: cryptoStatus, details: cryptoDetails },
  }
}
