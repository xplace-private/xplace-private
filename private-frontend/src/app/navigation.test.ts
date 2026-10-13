import { createMemoryHistory } from '@tanstack/react-router'
import { describe, expect, test } from 'vitest'

import {
  completeOnboarding,
  completeVerification,
  finishSumsubVerification,
  returnToAuthentication,
  returnToHome,
  startSumsubVerification,
} from './navigation'

describe('app navigation policy', () => {
  test('replaces completed post-auth flow steps so browser Back cannot reopen them', () => {
    const history = createMemoryHistory({ initialEntries: ['/onboarding'] })

    completeOnboarding(history)
    history.flush()
    completeVerification(history)
    history.flush()

    expect(history.location.pathname).toBe('/home')
    expect(history.length).toBe(1)
    expect(history.canGoBack()).toBe(false)
  })

  test('returns from onboarding to an existing authentication history entry', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/', '/onboarding'],
      initialIndex: 1,
    })
    let signOutCalls = 0

    await returnToAuthentication(history, async () => {
      signOutCalls += 1
      return true
    })
    history.flush()

    expect(history.location.pathname).toBe('/')
    expect(history.canGoBack()).toBe(false)
    expect(signOutCalls).toBe(0)
  })

  test('signs out before replacing a directly opened onboarding route', async () => {
    const history = createMemoryHistory({ initialEntries: ['/onboarding'] })
    let signOutCalls = 0

    await returnToAuthentication(history, async () => {
      signOutCalls += 1
      return true
    })
    history.flush()

    expect(history.location.pathname).toBe('/')
    expect(history.canGoBack()).toBe(false)
    expect(signOutCalls).toBe(1)
  })

  test('keeps direct onboarding open when backend sign-out fails', async () => {
    const history = createMemoryHistory({ initialEntries: ['/onboarding'] })

    await returnToAuthentication(history, () => Promise.resolve(false))
    history.flush()

    expect(history.location.pathname).toBe('/onboarding')
  })

  test('returns from a child route to the existing home entry', () => {
    const history = createMemoryHistory({
      initialEntries: ['/home', '/transactions'],
      initialIndex: 1,
    })

    returnToHome(history)
    history.flush()

    expect(history.location.pathname).toBe('/home')
    expect(history.length).toBe(2)
  })

  test('replaces a directly opened child route with home', () => {
    const history = createMemoryHistory({ initialEntries: ['/payment'] })

    returnToHome(history)
    history.flush()

    expect(history.location.pathname).toBe('/home')
    expect(history.canGoBack()).toBe(false)
  })

  test('pushes the Sumsub SDK so browser Back returns to its introduction', () => {
    const history = createMemoryHistory({ initialEntries: ['/verification'] })

    startSumsubVerification(history)
    history.flush()

    expect(history.location.pathname).toBe('/verification/sumsub')
    expect(history.canGoBack()).toBe(true)

    history.back()
    history.flush()

    expect(history.location.pathname).toBe('/verification')
  })

  test('replaces the Sumsub SDK so browser Back cannot reopen it after exit', () => {
    const history = createMemoryHistory({
      initialEntries: ['/verification', '/verification/sumsub'],
      initialIndex: 1,
    })

    finishSumsubVerification(history)
    history.flush()

    expect(history.location.pathname).toBe('/verification')

    history.back()
    history.flush()

    expect(history.location.pathname).toBe('/verification')
  })
})
