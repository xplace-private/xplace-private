import { environmentManager } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import { createMockAuthGateway } from '../features/auth/api/mock-auth-gateway'
import { createHttpHomeGateway } from '../features/home/api/http-home-gateway'
import { createHttpProfileGateway } from '../features/profile/api/http-profile-gateway'
import { queryClient } from './query-client'
import { routeTree } from './routeTree.gen'

test.each([200, 500])('Home keeps the company and renders real dashboard values or safe errors for HTTP %i', async status => {
  const baseUrl = 'https://api.example.test/partner/portal/v1/'
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    if (request.url.endsWith('/me/')) return Response.json({
      partner: { name: 'Acme Partners', slug: 'acme' },
      account: { full_name: 'Alex Partner', email: 'alex@example.test', phone: '' },
      must_change_password: false, totp_configured: true,
    })
    if (request.url.includes('/dashboard/')) {
      if (status === 500) return Response.json({ error: 'Unavailable' }, { status })
      if (request.url.includes('/summary/')) return Response.json({
        spend_cents: 123456, completed_purchases: 3, pending_purchases: 2, average_check_cents: 24691,
        active_clients: 4, overdue_clients: 1, suspended_clients: 2,
        commission_earned_cents: 98765, commission_available_cents: 54321,
      })
      return Response.json({ months: Array.from({ length: 12 }, (_, index) => ({
        month: `2026-${String(index + 1).padStart(2, '0')}`, spend_cents: 0, commission_cents: 12345,
      })) })
    }
    return Response.json({
      counts: { active: 0, onboarding: 0, partner_review: 0, limit_review: 0, overdue: 0, suspended: 0 },
      results: [], total: 0, page: 1, page_size: 10,
    })
  }
  const router = createRouter({
    routeTree,
    context: {
      authGateway: { ...createMockAuthGateway(), getSession: async () => 'authenticated' as const },
      homeGateway: createHttpHomeGateway({ baseUrl, fetch }),
      profileGateway: createHttpProfileGateway({ baseUrl, fetch }),
    },
    history: createMemoryHistory({ initialEntries: ['/home'] }),
    isServer: false,
    origin: 'http://localhost',
  })
  const defaultOptions = queryClient.getDefaultOptions()
  const isServer = environmentManager.isServer()
  queryClient.clear()
  // Run real query functions during server renders, without adding a DOM dependency.
  environmentManager.setIsServer(() => false)
  queryClient.setDefaultOptions({ ...defaultOptions, queries: { ...defaultOptions.queries, experimental_prefetchInRender: true } })
  try {
    await router.load()
    await vi.waitFor(() => {
      const html = renderToString(<RouterProvider router={router} />)
      if (status === 500) {
        expect(html).toContain('Unable to load your dashboard. Please try again.')
        expect(html.match(/role="alert"/g)).toHaveLength(2)
      } else {
        expect(html).toContain('$988')
        expect(html).toContain('Available for payout: $543')
        expect(html).not.toContain('Unable to load your dashboard.')
        expect(html.match(/data-slot="chart"/g)).toHaveLength(2)
      }
      expect(html).toContain('Acme Partners')
      expect(html).not.toContain('Not available')
      expect(html).not.toContain('$142,369')
      expect(html).not.toContain('$1,230')
      expect(html).not.toContain('data-mock="true"')
    })
  } finally {
    queryClient.clear()
    queryClient.setDefaultOptions(defaultOptions)
    environmentManager.setIsServer(() => isServer)
  }
})
