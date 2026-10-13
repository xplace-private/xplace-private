import { readFile } from 'node:fs/promises'

import { test as base, type Page } from '@playwright/test'

import { RouteErrorScreen } from '../components/route-error-screen'
import { SESSION_FILE } from '../data/session'
import { AuthFlow } from '../flows/auth-flow'
import { HomePage } from '../pages/home-page'
import { ProfilePage } from '../pages/profile-page'
import { SignInPage } from '../pages/sign-in-page'
import { SessionStorageFailure } from './session-storage-failure'

interface Fixtures {
  signInPage: SignInPage
  authFlow: AuthFlow
  /** Authenticated Home with the clients table loaded. */
  homePage: HomePage
  /** Authenticated Profile. */
  profilePage: ProfilePage
  /** Authenticated Home that is not opened yet, e.g. to install page.clock first. */
  unopenedHomePage: HomePage
  /** Authenticated Profile that is not opened yet. */
  unopenedProfilePage: ProfilePage
  sessionStorageFailure: SessionStorageFailure
  routeErrorScreen: RouteErrorScreen
}

/**
 * Seeds the saved sessionStorage once per test: the marker keeps later documents (reloads,
 * logout) from being re-seeded, so those flows behave as in a real tab. sessionStorage.clear()
 * also removes the marker, so the next document is re-seeded: tests that clear storage must
 * use authFlow instead of an authenticated fixture.
 */
async function restoreSession(page: Page): Promise<void> {
  const entries: Record<string, string> = JSON.parse(await readFile(SESSION_FILE, 'utf8'))
  await page.context().addInitScript((saved) => {
    const marker = '__e2e_session_restored'
    if (window.sessionStorage.getItem(marker) !== null) return
    for (const [key, value] of Object.entries(saved)) window.sessionStorage.setItem(key, value)
    window.sessionStorage.setItem(marker, 'true')
  }, entries)
}

export const test = base.extend<Fixtures>({
  signInPage: async ({ page }, provide) => {
    await provide(await new SignInPage(page).open())
  },
  authFlow: async ({ page }, provide) => {
    await provide(new AuthFlow(page))
  },
  homePage: async ({ page }, provide) => {
    await restoreSession(page)
    const homePage = await new HomePage(page).open()
    await homePage.clients.waitUntilLoaded()
    await provide(homePage)
  },
  profilePage: async ({ page }, provide) => {
    await restoreSession(page)
    await provide(await new ProfilePage(page).open())
  },
  unopenedHomePage: async ({ page }, provide) => {
    await restoreSession(page)
    await provide(new HomePage(page))
  },
  unopenedProfilePage: async ({ page }, provide) => {
    await restoreSession(page)
    await provide(new ProfilePage(page))
  },
  sessionStorageFailure: async ({ page }, provide) => {
    await provide(new SessionStorageFailure(page))
  },
  routeErrorScreen: async ({ page }, provide) => {
    await provide(new RouteErrorScreen(page))
  },
})

export { expect } from '@playwright/test'
