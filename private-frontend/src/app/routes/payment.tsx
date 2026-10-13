import { createFileRoute } from '@tanstack/react-router'

import { PaymentRoute } from '../payment-route'

export const Route = createFileRoute('/payment')({
  component: PaymentRoute,
})
