import { PARTNER } from '../data/clients'
import { MOCK_CODE, TEST_USER } from '../data/users'
import { expect, test } from '../fixtures/test'

test(
  'initial setup goes from sign-in through authenticator and password setup to Home',
  { tag: '@both' },
  async ({ page, signInPage }) => {
    await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
    await expect(signInPage.heading).toBeFocused()

    const authenticator = await signInPage.signIn(TEST_USER)

    await expect(page).toHaveURL((url) => url.pathname === '/auth/authenticator')
    await expect(authenticator.heading).toBeFocused()
    await expect.soft(authenticator.setupSteps).toHaveCount(4)
    await expect.soft(authenticator.openInAppButton).toBeVisible()

    const setPassword = await authenticator.verify(MOCK_CODE)

    await expect(page).toHaveURL((url) => url.pathname === '/auth/set-password')
    await expect(setPassword.heading).toBeFocused()
    await expect(page.getByText('Password Requirements')).toBeVisible()

    const homePage = await setPassword.setPassword(TEST_USER.password)

    await expect(page).toHaveURL((url) => url.pathname === '/home')
    await expect(homePage.header.companyButton).toHaveText(PARTNER.company)
  },
)

test('sign-in form reports missing, invalid and blank credentials without leaving the page', async ({
  page,
  signInPage,
}) => {
  await signInPage.signInButton.click()

  await expect(signInPage.alerts.filter({ hasText: 'This field is required' })).toHaveCount(2)
  await expect(signInPage.emailInput).toBeFocused()

  await signInPage.submit('partner', TEST_USER.password)

  await expect(signInPage.alerts.filter({ hasText: 'Enter a valid email address.' })).toBeVisible()

  await signInPage.submit(TEST_USER.email, '   ')

  await expect(signInPage.alerts.filter({ hasText: 'Enter your email and password.' })).toBeVisible()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
})

test('authenticator rejects wrong and malformed codes and accepts the mock code', async ({ signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)

  await authenticator.submitCode('000000')

  await expect(authenticator.errorAlert).toHaveText('Incorrect code')
  await expect(authenticator.codeInput).toHaveAttribute('aria-invalid', 'true')

  await authenticator.codeInput.clear()
  await authenticator.codeInput.pressSequentially('1')

  await expect(authenticator.errorAlert).toHaveCount(0)

  await authenticator.submitCode('123')

  await expect(authenticator.errorAlert).toHaveText('Incorrect code')

  await authenticator.codeInput.fill('abc')

  await expect(authenticator.codeInput).toHaveValue('')

  const setPassword = await authenticator.verify(MOCK_CODE)

  await expect(setPassword.heading).toBeVisible()
})

test('password setup rejects weak and mismatched passwords and focuses the failing field', async ({ signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)
  const setPassword = await authenticator.verify(MOCK_CODE)

  await setPassword.submit('partner1', 'partner1')

  await expect(
    setPassword.alerts.filter({ hasText: 'Your password must meet all the requirements below.' }),
  ).toBeVisible()
  await expect(setPassword.passwordInput).toBeFocused()

  await setPassword.submit('Partner1!', 'Partner2!')

  await expect(setPassword.alerts.filter({ hasText: 'Passwords do not match.' })).toBeVisible()
  await expect(setPassword.confirmationInput).toBeFocused()
})

test('unfinished auth actions show a WIP toast', async ({ page, signInPage }) => {
  await signInPage.forgotPasswordButton.click()

  await expect(signInPage.toast.withText('WIP')).toBeVisible()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/sign-in')
  await expect(signInPage.toast.withText('WIP')).toBeHidden()

  const authenticator = await signInPage.signIn(TEST_USER)
  await authenticator.openInAppButton.click()

  await expect(authenticator.toast.withText('WIP')).toBeVisible()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/authenticator')
})

test('pressing Enter in the password field submits sign-in', { tag: '@both' }, async ({ signInPage }) => {
  const authenticator = await signInPage.submitWithEnter(TEST_USER)

  await expect(authenticator.heading).toBeVisible()
})

test('field errors clear as the user edits the form', async ({ signInPage }) => {
  const requiredErrors = signInPage.alerts.filter({ hasText: 'This field is required' })
  await signInPage.signInButton.click()

  await expect(requiredErrors).toHaveCount(2)

  await signInPage.emailInput.fill(TEST_USER.email)

  await expect(requiredErrors).toHaveCount(1)

  const authenticator = await signInPage.signIn(TEST_USER)
  const setPassword = await authenticator.verify(MOCK_CODE)
  await setPassword.submit('partner1', 'partner1')

  await expect(setPassword.alerts.filter({ hasText: 'Your password must meet all the requirements below.' })).toBeVisible()

  await setPassword.passwordInput.fill('P')

  await expect(setPassword.alerts).toHaveCount(0)
})

test('the password mismatch error clears when the confirmation is edited', async ({ signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)
  const setPassword = await authenticator.verify(MOCK_CODE)
  await setPassword.submit('Partner1!', 'Partner2!')

  await expect(setPassword.alerts.filter({ hasText: 'Passwords do not match.' })).toBeVisible()

  await setPassword.confirmationInput.fill('Partner1!')

  await expect(setPassword.alerts).toHaveCount(0)
})

test('authenticator setup shows its instructions and treats an empty code as incorrect', async ({ signInPage }) => {
  const authenticator = await signInPage.signIn(TEST_USER)

  await expect(authenticator.setupSteps).toHaveCount(4)
  await expect.soft(authenticator.setupSteps.nth(2)).toContainText('Confirm the account (XPlace Partners) is added')
  await expect.soft(authenticator.setupSteps.nth(3)).toContainText('Enter the 6-digit code the app shows you')
  await expect.soft(authenticator.hint).toBeVisible()

  await authenticator.continueButton.click()

  await expect(authenticator.errorAlert).toHaveText('Incorrect code')
  await expect(authenticator.codeInput).toBeFocused()
})

test('Alt+T moves focus to the notifications', async ({ page, signInPage }) => {
  await signInPage.forgotPasswordButton.click()
  await expect(signInPage.toast.withText('WIP')).toBeVisible()

  await page.keyboard.press('Alt+T')

  await expect(signInPage.toast.list).toBeFocused()
})
