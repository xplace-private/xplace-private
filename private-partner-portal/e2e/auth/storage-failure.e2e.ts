import { TEST_USER } from '../data/users'
import { expect, test } from '../fixtures/test'

const STORAGE_ERROR = 'Unable to access your session. Check browser storage settings and try again.'

test(
  'blocked session storage on sign-in shows a storage error and stays on sign-in',
  { tag: '@both' },
  async ({ page, signInPage, sessionStorageFailure }) => {
    await sessionStorageFailure.failWrites()

    await signInPage.submit(TEST_USER.email, TEST_USER.password)

    await expect(signInPage.alerts.filter({ hasText: STORAGE_ERROR })).toBeVisible()
    await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  },
)

test(
  'blocked session storage on logout keeps the user on Home with an error',
  { tag: '@both' },
  async ({ page, homePage, sessionStorageFailure }) => {
    await sessionStorageFailure.failWrites()

    await homePage.header.logOutButton.click()

    await expect(homePage.header.signOutError).toHaveText(STORAGE_ERROR)
    await expect(page).toHaveURL((url) => url.pathname === '/home')
  },
)
