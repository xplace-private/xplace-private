import { PARTNER } from '../data/clients'
import { MOCK_SESSION_KEY } from '../data/session'
import { MOCK_CODE, TEST_USER } from '../data/users'
import { expect, test } from '../fixtures/test'

test('anonymous visit to root redirects to sign-in', { tag: '@both' }, async ({ page, authFlow }) => {
  const signInPage = await authFlow.openRoot()

  await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  await expect(signInPage.heading).toBeVisible()
})

test('anonymous direct links to protected, unavailable and unknown routes land on sign-in', async ({ page }) => {
  const paths = ['/home', '/profile', '/auth/authenticator', '/auth/set-password', '/no-such-page']

  for (const path of paths) {
    await page.goto(path)

    await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  }
})

test('authenticated user is redirected to Home from auth and unknown routes', async ({
  page,
  homePage,
}) => {
  const redirectedPaths = ['/', '/auth/sign-in', '/auth/set-password', '/no-such-page']

  for (const path of redirectedPaths) {
    await page.goto(path)

    await expect(page).toHaveURL((url) => url.pathname === '/home')
    await expect(homePage.header.companyButton).toHaveText(PARTNER.company)
  }
})

test('authenticated user may open Profile', async ({ page, profilePage }) => {
  await expect(page).toHaveURL((url) => url.pathname === '/profile')
  await expect(profilePage.heading).toBeAttached()
})

test('user mid-setup is kept on the authenticator step', async ({ page, signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)
  const guardedPaths = ['/home', '/auth/set-password', '/auth/sign-in']

  for (const path of guardedPaths) {
    await page.goto(path)

    await expect(page).toHaveURL((url) => url.pathname === '/auth/authenticator')
    await expect(authenticator.heading).toBeVisible()
  }
})

test('user on the password step is kept there', async ({ page, signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)
  const setPassword = await authenticator.verify(MOCK_CODE)
  const guardedPaths = ['/home', '/auth/authenticator', '/auth/sign-in', '/']

  for (const path of guardedPaths) {
    await page.goto(path)

    await expect(page).toHaveURL((url) => url.pathname === '/auth/set-password')
    await expect(setPassword.heading).toBeVisible()
  }
})

test('returning user awaiting 2FA is kept on the verification step', async ({ page, authFlow }) => {
  const homePage = await authFlow.completeInitialSetup(TEST_USER)
  const returningSignIn = await homePage.header.logOut()
  const authenticator = await returningSignIn.signInReturning(TEST_USER)
  const guardedPaths = ['/home', '/auth/set-password']

  for (const path of guardedPaths) {
    await page.goto(path)

    await expect(page).toHaveURL((url) => url.pathname === '/auth/authenticator')
    await expect(authenticator.heading).toBeVisible()
  }
})

test('an expired step sends the user back to sign-in', async ({ page, signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)
  await page.evaluate((key) => window.sessionStorage.removeItem(key), MOCK_SESSION_KEY)

  await authenticator.submitCode(MOCK_CODE)

  await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  await expect(signInPage.heading).toBeVisible()
})
