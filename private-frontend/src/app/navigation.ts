import type { RouterHistory } from '@tanstack/react-router'

type AppHistory = Pick<RouterHistory, 'back' | 'canGoBack' | 'push' | 'replace'>

/** Removes the completed application form from browser history. */
export function completeOnboarding(history: AppHistory) {
  history.replace('/verification')
}

/** Removes the completed verification status screen from browser history. */
export function completeVerification(history: AppHistory) {
  history.replace('/home')
}

/** Keeps the verification introduction available to browser Back. */
export function startSumsubVerification(history: AppHistory) {
  history.push('/verification/sumsub')
}

/** Removes the finished or failed SDK entry from browser history. */
export function finishSumsubVerification(history: AppHistory) {
  history.replace('/verification')
}

/** Returns from onboarding, signing out when no earlier page is available. */
export async function returnToAuthentication(
  history: AppHistory,
  signOut: () => Promise<boolean>,
) {
  if (history.canGoBack()) {
    history.back()
    return
  }

  if (await signOut()) history.replace('/')
}

/** Pops a home-owned child route, with a safe fallback for direct links. */
export function returnToHome(history: AppHistory) {
  if (history.canGoBack()) {
    history.back()
    return
  }

  history.replace('/home')
}
