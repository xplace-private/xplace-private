import { createFileRoute } from '@tanstack/react-router'

import { TransactionsRoute } from '../transactions-route'

export const Route = createFileRoute('/transactions')({
  component: TransactionsRoute,
})
