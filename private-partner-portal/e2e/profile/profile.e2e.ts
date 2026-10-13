import { PARTNER, SUPPORT_URL } from '../data/clients'
import { expect, test } from '../fixtures/test'

test('the company name opens Profile with account details that survive reload', { tag: '@both' }, async ({ page, homePage }) => {
  const profilePage = await homePage.header.openProfile()

  await expect(profilePage.heading).toBeAttached()
  await expect.soft(page.getByRole('heading', { name: 'Account Information', level: 2 })).toBeVisible()
  await expect.soft(profilePage.field('Full name')).toContainText(PARTNER.fullName)
  await expect.soft(profilePage.field('Email address')).toContainText(PARTNER.email)
  await expect.soft(profilePage.field('Phone number')).toContainText(PARTNER.phone)
  await expect.soft(profilePage.field('Company')).toContainText(PARTNER.company)
  await expect.soft(page.getByRole('heading', { name: 'Security Settings', level: 2 })).toBeVisible()
  await expect.soft(profilePage.supportLink).toHaveAttribute('href', SUPPORT_URL)
  await expect.soft(profilePage.supportLink).toHaveAttribute('target', '_blank')
  await expect.soft(profilePage.supportLink).toHaveAttribute('rel', 'noopener noreferrer')
  await expect.soft(profilePage.supportLink).toHaveAccessibleName(
    'To update your registered company name, partner ID, or primary role, please submit an official request to our partner support desk.',
  )
  await expect.soft(page.getByText('Review your password strength and control active sessions to prevent unauthorized access.')).toBeVisible()

  await profilePage.reload()

  await expect.soft(page.getByRole('heading', { name: 'Account Information', level: 2 })).toBeVisible()
  await expect.soft(profilePage.field('Full name')).toContainText(PARTNER.fullName)
  await expect.soft(profilePage.field('Email address')).toContainText(PARTNER.email)
  await expect.soft(profilePage.field('Phone number')).toContainText(PARTNER.phone)
  await expect.soft(profilePage.field('Company')).toContainText(PARTNER.company)
  await expect.soft(profilePage.supportLink).toHaveAttribute('href', SUPPORT_URL)

  await profilePage.header.homeLogo.click()

  await expect(page).toHaveURL((url) => url.pathname === '/home')
})

test('Change Password opens the form, submit and Sign out all sessions are WIP, Escape restores focus', async ({ page, profilePage }) => {
  const modal = await profilePage.changePassword()

  await expect.soft(modal.dialog).toBeFocused()
  await expect.soft(modal.newPasswordInput).not.toBeFocused()
  await expect.soft(modal.confirmPasswordInput).not.toBeFocused()
  await expect.soft(modal.dialog.getByText('Change password for your account')).toBeVisible()
  await expect.soft(modal.dialog.getByText('Password Requirements')).toBeVisible()

  await modal.fill('Partner1!', 'Partner1!')
  await modal.submit()

  await expect(profilePage.toast.withText('WIP')).toBeVisible()
  await expect(modal.dialog).toBeVisible()
  // The toast lasts 2.5s; a second identical one would make the next assertion ambiguous.
  await expect(profilePage.toast.withText('WIP')).toBeHidden()

  await modal.pressEscape()

  await expect(modal.dialog).toBeHidden()
  await expect(profilePage.changePasswordButton).toBeFocused()

  await profilePage.signOutAllSessionsButton.click()

  await expect(profilePage.toast.withText('WIP')).toBeVisible()
  await expect(page).toHaveURL((url) => url.pathname === '/profile')
  await expect(profilePage.header.logOutButton).toBeVisible()
})

test('Change Password closes on an outside click and returns focus', { tag: '@both' }, async ({ profilePage }) => {
  const modal = await profilePage.changePassword()

  await expect(modal.dialog.getByText('Minimum 8 characters, at least one uppercase letter, one number, and one special character.')).toBeVisible()

  await modal.closeByClickingOutside()

  await expect(modal.dialog).toBeHidden()
  await expect(profilePage.changePasswordButton).toBeFocused()
})

test('header logo on Home and company button on Profile leave the page unchanged, and Log Out works from Profile', { tag: '@both' }, async ({ page, homePage }) => {
  await homePage.header.homeLogo.click()

  await expect(page).toHaveURL((url) => url.pathname === '/home')
  await expect.soft(homePage.heading).toBeAttached()
  await expect.soft(homePage.clients.summary).toBeVisible()

  const profilePage = await homePage.header.openProfile()
  await profilePage.header.companyButton.click()

  await expect(page).toHaveURL((url) => url.pathname === '/profile')
  await expect.soft(profilePage.heading).toBeAttached()
  await expect.soft(profilePage.field('Company')).toContainText(PARTNER.company)

  const signInPage = await profilePage.header.logOut()

  await expect(signInPage.heading).toBeVisible()
})
