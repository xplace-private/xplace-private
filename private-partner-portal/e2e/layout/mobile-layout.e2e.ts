import type { Locator, Page } from '@playwright/test'

import { OFFBOARDING_CLIENT, OVERDUE_CLIENT, PARTNER, PARTNER_REVIEW_CLIENT, SUSPENDED_CLIENT } from '../data/clients'
import { MOCK_CODE, TEST_USER } from '../data/users'
import { expect, test } from '../fixtures/test'

const MIN_FONT_SIZE_PX = 16

// Call it only after the page content has loaded: a skeleton can be narrower than the real content.
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  if (viewport === null) return
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width)
}

async function fontSizeOf(input: Locator): Promise<number> {
  return input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
}

async function expectFitsViewport(page: Page, element: Locator): Promise<void> {
  const box = await element.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (box === null || viewport === null) return
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
}

test('auth, Home and Profile pages have no horizontal overflow and inputs avoid focus zoom', { tag: '@mobile-only' }, async ({ page, signInPage }) => {
  await expectNoHorizontalOverflow(page)
  await expect.soft(signInPage.emailInput).toBeVisible()
  expect.soft(await fontSizeOf(signInPage.emailInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)
  expect.soft(await fontSizeOf(signInPage.passwordInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)

  const authenticator = await signInPage.signIn(TEST_USER)

  await expectNoHorizontalOverflow(page)
  expect.soft(await fontSizeOf(authenticator.codeInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)

  const setPassword = await authenticator.verify(MOCK_CODE)

  await expectNoHorizontalOverflow(page)
  expect.soft(await fontSizeOf(setPassword.passwordInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)
  expect.soft(await fontSizeOf(setPassword.confirmationInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)

  const homePage = await setPassword.setPassword(TEST_USER.password)
  await homePage.clients.waitUntilLoaded()

  await expectNoHorizontalOverflow(page)
  expect.soft(await fontSizeOf(homePage.clients.searchInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)
  const { scrollContainer } = homePage.clients
  const scrollsInside = await scrollContainer.evaluate((element) => element.scrollWidth > element.clientWidth)
  expect.soft(scrollsInside).toBe(true)
  const overflowX = await scrollContainer.evaluate((element) => getComputedStyle(element).overflowX)
  expect.soft(['auto', 'scroll']).toContain(overflowX)

  const profilePage = await homePage.header.openProfile()
  await expect(profilePage.field('Email address')).toContainText(PARTNER.email)

  await expectNoHorizontalOverflow(page)
})

test('payment and partner review dialogs fit within the mobile viewport', { tag: '@mobile-only' }, async ({ page, homePage }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)
  await payment.selectMethod('Crypto')

  await expect(payment.qrCode).toBeVisible()
  await expectFitsViewport(page, payment.dialog)
  await expectNoHorizontalOverflow(page)

  await payment.close()

  await expect(payment.dialog).toBeHidden()

  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await expectFitsViewport(page, review.dialog)
  await expectNoHorizontalOverflow(page)
  expect.soft(await fontSizeOf(review.investableInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)
  expect.soft(await fontSizeOf(review.cashInput)).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)
})

test('overdue and offboarding dialogs fit within the mobile viewport', { tag: '@mobile-only' }, async ({ page, homePage }) => {
  const overdue = await homePage.clients.openPayment(OVERDUE_CLIENT)

  await expectFitsViewport(page, overdue.dialog)
  await expectNoHorizontalOverflow(page)

  await overdue.close()

  await expect(overdue.dialog).toBeHidden()

  const offboarding = await homePage.clients.openPayment(OFFBOARDING_CLIENT)

  await expectFitsViewport(page, offboarding.dialog)
  await expectNoHorizontalOverflow(page)
})
