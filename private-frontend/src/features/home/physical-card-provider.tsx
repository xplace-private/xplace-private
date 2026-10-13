import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, type ReactNode } from 'react'
import type { PhysicalCardGateway } from './api/http-physical-card-gateway'
import { useCards } from './cards-provider'
import type { CardRecipient } from './model/physical-card-order'
import { PRIVATE_BALANCE_QUERY_KEY } from './private-balance-query'
import { TRANSACTIONS_QUERY_KEY } from './transactions-query'
import { usePhysicalCardOrder, type PhysicalCardFlow } from './use-physical-card-order'

const PhysicalCardContext = createContext<PhysicalCardFlow | null>(null)

export function PhysicalCardProvider({ gateway, recipient, sessionKey, children, enabled }: {
  enabled: boolean
  gateway: PhysicalCardGateway
  recipient: CardRecipient
  sessionKey: string
  children: ReactNode
}) {
  const client = useQueryClient()
  const { refreshPhysical } = useCards()
  const onPaid = useCallback(() => {
    void client.invalidateQueries({ queryKey: PRIVATE_BALANCE_QUERY_KEY })
    void client.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
  }, [client])
  const flow = usePhysicalCardOrder({ enabled, gateway, recipient, sessionKey, onIssued: refreshPhysical, onPaid })
  return <PhysicalCardContext value={flow}>{children}</PhysicalCardContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePhysicalCard() { return useContext(PhysicalCardContext) }
