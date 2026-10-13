import { PARTNER } from '../data/clients'
import { MOCK_SESSION_KEY } from '../data/session'
import { MOCK_CODE, TEST_USER } from '../data/users'
import { expect, test } from '../fixtures/test'

test('reloading Home keeps the user signed in', { tag: '@both' }, async ({ page, homePage }) => {
  await homePage.reload()

  await expect(page).toHaveURL((url) => url.pathname === '/home')
  await expect.soft(homePage.header.companyButton).toHaveText(PARTNER.company)
  await expect.soft(homePage.clients.summary).toHaveText('Showing 10 of 47 clients')
})

test('reloading mid-setup restores the unfinished step', async ({ page, signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)

  await authenticator.reload()

  await expect(authenticator.heading).toBeVisible()

  const setPassword = await authenticator.verify(MOCK_CODE)
  await setPassword.reload()

  await expect(page).toHaveURL((url) => url.pathname === '/auth/set-password')
  await expect(setPassword.heading).toBeVisible()
})

test('logging out returns to sign-in and gates Home', { tag: '@both' }, async ({ page, homePage }) => {
  const signInPage = await homePage.header.logOut()

  await page.goto('/home')

  await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  await expect(signInPage.heading).toBeVisible()
})

test('returning user signs in with 2FA only and lands on Home', async ({ page, authFlow }) => {
  const homePage = await authFlow.completeInitialSetup(TEST_USER)
  const returningSignIn = await homePage.header.logOut()

  const authenticator = await returningSignIn.signInReturning(TEST_USER)

  await expect(authenticator.heading).toBeVisible()
  await expect.soft(authenticator.openInAppButton).toHaveCount(0)
  await expect.soft(authenticator.setupSteps).toHaveCount(0)

  const returnedHome = await authenticator.verifyReturning(MOCK_CODE)

  await expect(page).toHaveURL((url) => url.pathname === '/home')
  await expect(returnedHome.header.companyButton).toHaveText(PARTNER.company)
})

test('clearing session storage after logout restarts initial setup', async ({ page, authFlow }) => {
  const homePage = await authFlow.completeInitialSetup(TEST_USER)
  const signInPage = await homePage.header.logOut()

  await page.evaluate(() => window.sessionStorage.clear())
  await signInPage.reload()
  const authenticator = await signInPage.signIn(TEST_USER)

  await expect(authenticator.heading).toBeVisible()
  await expect(authenticator.openInAppButton).toBeVisible()
})

test('invalid stored session status starts a fresh sign-in', async ({ page, signInPage }) => {
  await page.evaluate((key) => window.sessionStorage.setItem(key, 'bogus'), MOCK_SESSION_KEY)

  await page.goto('/home')

  await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  await expect(signInPage.heading).toBeVisible()

  // Treated as a fresh tab (setup variant), not as a signed-out returning user.
  const authenticator = await signInPage.signIn(TEST_USER)

  await expect(authenticator.heading).toBeVisible()
  await expect(authenticator.openInAppButton).toBeVisible()
})
