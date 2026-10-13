import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import type { PartnerClient } from './api/home-gateway'
import { ClientActionInfo } from './home-client-actions'

const client: PartnerClient = {
  id: 'client-9', name: 'David Mitchell', email: null, phone: null,
  registeredAt: null, closedAt: '2026-09-12', status: 'closed',
  paymentDetails: null, partnerReviewDetails: null,
}

const render = (value: PartnerClient) => renderToStaticMarkup(<ClientActionInfo client={value} />)

test('shows the status-specific information and uses the client closure date', () => {
  expect(render({ ...client, status: 'limit-review' })).toContain('A credit limit is being set up for the client.')
  expect(render({ ...client, status: 'onboarding' })).toContain('The user started the KYC process but did not finish.')
  const closed = render(client)
  expect(closed).toContain('Account closed.')
  expect(closed).toContain('closed on 12 September')
  expect(closed).toContain('aria-describedby=')
  expect(render({ ...client, closedAt: null })).toContain('closed on —')
  expect(render({ ...client, closedAt: 'not-a-date' })).toContain('closed on —')
})

test('action and modal statuses have no static status message', () => {
  for (const status of ['active', 'contact-support', 'partner-review', 'overdue', 'suspended', 'offboarding-pending'] as const) {
    expect(render({ ...client, status })).toBe('')
  }
})
