import { ACTIVE_CLIENT, CLOSED_CLIENT, CONTACT_SUPPORT_CLIENT, LIMIT_REVIEW_CLIENT, ONBOARDING_CLIENT, SUPPORT_URL, SUSPENDED_CLIENT } from '../data/clients'
import { expect, test } from '../fixtures/test'

test('active and contact-support menus link to WhatsApp support in a new tab', async ({ homePage, page }) => {
  const activeMenu = await homePage.clients.openMenu(ACTIVE_CLIENT)

  for (const name of ['AUM review', 'Request offboarding']) {
    await expect.soft(activeMenu.item(name)).toHaveAttribute('href', SUPPORT_URL)
    await expect.soft(activeMenu.item(name)).toHaveAttribute('target', '_blank')
    await expect.soft(activeMenu.item(name)).toHaveAttribute('rel', 'noopener noreferrer')
  }
  await expect.soft(activeMenu.item('Open')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(activeMenu.menu).toBeHidden()

  const supportMenu = await homePage.clients.openMenu(CONTACT_SUPPORT_CLIENT)

  await expect.soft(supportMenu.item('Contact Support')).toHaveAttribute('href', SUPPORT_URL)
  await expect.soft(supportMenu.item('Contact Support')).toHaveAttribute('target', '_blank')
  await expect.soft(supportMenu.item('Contact Support')).toHaveAttribute('rel', 'noopener noreferrer')
})

test('limit review, onboarding and closed menus offer no actions', async ({ homePage, page }) => {
  const limitMenu = await homePage.clients.openMenu(LIMIT_REVIEW_CLIENT)

  await expect.soft(limitMenu.items).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(limitMenu.menu).toBeHidden()

  const onboardingMenu = await homePage.clients.openMenu(ONBOARDING_CLIENT)

  await expect.soft(onboardingMenu.items).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(onboardingMenu.menu).toBeHidden()

  const closedMenu = await homePage.clients.openMenu(CLOSED_CLIENT)

  await expect.soft(closedMenu.items).toHaveCount(0)
})

test('client action menu works from the keyboard and Escape returns focus', async ({ homePage, page }) => {
  const { actionsMenu: menu } = homePage.clients
  const activeTrigger = homePage.clients.actionsButtonOf(ACTIVE_CLIENT)
  await activeTrigger.focus()

  await page.keyboard.press('Enter')

  await expect(menu.item('AUM review')).toBeFocused()

  await page.keyboard.press('ArrowDown')

  await expect(menu.item('Request offboarding')).toBeFocused()

  await page.keyboard.press('Escape')

  await expect(menu.menu).toBeHidden()
  await expect(activeTrigger).toBeFocused()

  const suspendedTrigger = homePage.clients.actionsButtonOf(SUSPENDED_CLIENT)
  await suspendedTrigger.focus()

  await page.keyboard.press('Enter')

  await expect(menu.item('Open')).toBeFocused()

  await page.keyboard.press('Enter')

  await expect(homePage.clients.paymentModalOf(SUSPENDED_CLIENT).dialog).toBeVisible()
})
