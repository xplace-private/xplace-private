import { describe, expect, test } from 'vitest'

import { completeOnboarding } from './complete-onboarding'

describe('completeOnboarding', () => {
  test('emits completion after the final step succeeds', async () => {
    let completionCount = 0

    await completeOnboarding(
      () => Promise.resolve(true),
      () => {
        completionCount += 1
      },
    )

    expect(completionCount).toBe(1)
  })

  test('stays on onboarding when final-step submission fails', async () => {
    let completionCount = 0

    await completeOnboarding(
      () => Promise.resolve(false),
      () => {
        completionCount += 1
      },
    )

    expect(completionCount).toBe(0)
  })

  test('waits for completion work before resolving', async () => {
    let releaseCompletion = () => {}
    const completionWork = new Promise<void>((resolve) => {
      releaseCompletion = resolve
    })
    let settled = false
    const completion = completeOnboarding(
      () => Promise.resolve(true),
      () => completionWork,
    )
    void completion.then(() => {
      settled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(false)

    releaseCompletion()
    await completion

    expect(settled).toBe(true)
  })

  test('retries completion work without submitting the applicant again', async () => {
    let submissionCount = 0
    let completionCount = 0

    const result = await completeOnboarding(
      () => {
        submissionCount += 1
        return Promise.resolve(true)
      },
      () => {
        completionCount += 1
        return true
      },
      true,
    )

    expect(result).toBe('completed')
    expect(submissionCount).toBe(0)
    expect(completionCount).toBe(1)
  })
})
