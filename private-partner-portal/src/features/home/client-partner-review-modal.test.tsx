import { afterEach, expect, test, vi } from 'vitest'

import { mockHomeGateway } from './api/mock-home-gateway'
import { formatAmountInput, formatAmountOnBlur, parseAmount } from './partner-review-amount'

const signal = () => new AbortController().signal
const query = { search: '', status: 'all' as const, page: 1, pageSize: 100 }
const file = new File(['aum'], 'confirmation.pdf', { type: 'application/pdf' })

afterEach(() => vi.useRealTimers())

test('accepts zero and cents without floating-point rejection, but rejects malformed money', () => {
  expect(parseAmount('0')).toBe(0)
  expect(parseAmount('0.')).toBe(0)
  expect(parseAmount('0.29')).toBe(0.29)
  expect(parseAmount('12312.')).toBe(12312)
  expect(parseAmount('12,312.')).toBe(12312)
  expect(parseAmount('1,200,000.00')).toBe(1_200_000)
  for (const value of ['', '.', '-1', '1.234', '1,2', 'abc', '90071992547410']) expect(parseAmount(value)).toBeNull()
})

test('formats amounts as typed while keeping decimal entry and the caret editable', () => {
  expect(formatAmountInput('1234', 4)).toEqual({ value: '1,234', caret: 5 })
  expect(formatAmountInput('123,', 4, '123', 'insertText')).toEqual({ value: '123.', caret: 4 })
  expect(formatAmountInput('0.', 2, '0', 'insertText')).toEqual({ value: '0.', caret: 2 })
  expect(formatAmountInput('900719925474099', 15, '90,071,992,547,409', 'insertText')).toEqual({ value: '90,071,992,547,409', caret: 15 })
  expect(formatAmountInput('900719925474099', 15, '', 'insertFromPaste')).toEqual({ value: '', caret: 0 })
  expect(formatAmountInput('123,45', 6, '', 'insertFromPaste')).toEqual({ value: '123.45', caret: 6 })
  expect(formatAmountInput('$1,234.56', 9, '', 'insertFromPaste')).toEqual({ value: '1,234.56', caret: 8 })
  expect(formatAmountInput('12a34', 3)).toEqual({ value: '1,234', caret: 3 })
  expect(formatAmountInput('1,934', 3, '1,234', 'insertText')).toEqual({ value: '1,934', caret: 3 })
  expect(formatAmountInput('1,9', 3, '1,234', 'insertText')).toEqual({ value: '19', caret: 2 })
  expect(formatAmountInput('1234', 1, '1,234', 'deleteContentBackward')).toEqual({ value: '234', caret: 0 })
  expect(formatAmountInput('1234', 1, '1,234', 'deleteContentForward')).toEqual({ value: '134', caret: 1 })
  expect(formatAmountOnBlur('123.')).toBe('123.00')
  expect(formatAmountOnBlur('12,312.')).toBe('12,312.00')
  expect(formatAmountOnBlur('90,071,992,547,409.91')).toBe('90,071,992,547,409.91')
})

test('mock upload can be aborted and only an uploaded, confirmed review moves the client and retains details', async () => {
  vi.useFakeTimers()
  const beforePending = mockHomeGateway.getClients(query, signal())
  await vi.advanceTimersByTimeAsync(450)
  const before = await beforePending
  const partnerReviewCount = before.counts['partner-review']
  if (partnerReviewCount === undefined) throw new Error('Missing partner-review fixture count')
  const limitReviewCount = before.counts['limit-review']

  expect(await mockHomeGateway.submitPartnerReview({ clientId: 'client-4', investableAssets: 0.29, cashAssets: 0, file, confirmed: true }, signal())).toMatchObject({ ok: false, code: 'incomplete' })
  const controller = new AbortController()
  const cancelled = mockHomeGateway.uploadAumConfirmation(file, controller.signal, () => {})
  const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  expect(vi.getTimerCount()).toBe(0)

  const progress: number[] = []
  const upload = mockHomeGateway.uploadAumConfirmation(file, signal(), (percent) => progress.push(percent))
  await vi.advanceTimersByTimeAsync(600)
  expect(await upload).toEqual({ ok: true })
  expect(progress).toEqual([25, 50, 75, 100])
  expect(await mockHomeGateway.submitPartnerReview({ clientId: 'client-4', investableAssets: -1, cashAssets: 0, file, confirmed: true }, signal())).toMatchObject({ ok: false, code: 'amount' })
  expect(await mockHomeGateway.submitPartnerReview({ clientId: 'client-4', investableAssets: 0.29, cashAssets: 0, file, confirmed: false }, signal())).toMatchObject({ ok: false, code: 'incomplete' })

  const submit = mockHomeGateway.submitPartnerReview({ clientId: 'client-4', investableAssets: 0.29, cashAssets: 1_200_000, file, confirmed: true }, signal())
  await vi.advanceTimersByTimeAsync(450)
  expect(await submit).toEqual({ ok: true })
  const afterPending = mockHomeGateway.getClients(query, signal())
  await vi.advanceTimersByTimeAsync(450)
  const after = await afterPending
  expect(after.counts['partner-review']).toBe(partnerReviewCount - 1)
  expect(after.counts['limit-review']).toBe(limitReviewCount + 1)
  expect(after.items.find((client) => client.id === 'client-4')).toMatchObject({
    status: 'limit-review',
    partnerReviewDetails: { investableAssets: 0.29, cashAssets: 1_200_000, fileName: 'confirmation.pdf', fileSize: file.size },
  })
})
