import { QueryClient, type QueryFunctionContext } from '@tanstack/react-query'
import { expect, test } from 'vitest'

import type { ApplicantGateway } from './api/applicant-gateway'
import {
  ApplicantQueryError,
  APPLICANT_QUERY_KEY,
  applicantQueryOptions,
} from './applicant-query'

function applicantQueryContext(
  signal: AbortSignal,
): QueryFunctionContext<typeof APPLICANT_QUERY_KEY> {
  return {
    client: new QueryClient(),
    queryKey: APPLICANT_QUERY_KEY,
    signal,
    meta: undefined,
  }
}

test('uses the applicant key, disables duplicate refetching, and forwards the abort signal', async () => {
  const signal = new AbortController().signal
  let receivedSignal: AbortSignal | undefined
  const gateway: ApplicantGateway = {
    get(gatewaySignal) {
      receivedSignal = gatewaySignal
      return Promise.resolve({ ok: true, data: null })
    },
  }
  const options = applicantQueryOptions(gateway)

  await expect(options.queryFn?.(applicantQueryContext(signal))).resolves.toBeNull()
  expect(APPLICANT_QUERY_KEY).toEqual(['verification', 'applicant'])
  expect(options.queryKey).toEqual(['verification', 'applicant'])
  expect(receivedSignal).toBe(signal)
  expect(options.retry).toBe(false)
  expect(options.refetchOnWindowFocus).toBe(false)
  expect(options.staleTime).toBe(Infinity)
})

test('resolves an absent applicant returned for HTTP 404', async () => {
  const gateway: ApplicantGateway = {
    get: () => Promise.resolve({ ok: true, data: null }),
  }

  await expect(
    applicantQueryOptions(gateway).queryFn?.(
      applicantQueryContext(new AbortController().signal),
    ),
  ).resolves.toBeNull()
})

test('throws an error with only the safe gateway code and message', async () => {
  const gateway: ApplicantGateway = {
    get: () =>
      Promise.resolve({
        ok: false,
        code: 'applicant-failed',
        message: 'Unable to load applicant. Try again.',
      }),
  }

  await expect(
    applicantQueryOptions(gateway).queryFn?.(
      applicantQueryContext(new AbortController().signal),
    ),
  ).rejects.toEqual(
    new ApplicantQueryError('applicant-failed', 'Unable to load applicant. Try again.'),
  )
})
