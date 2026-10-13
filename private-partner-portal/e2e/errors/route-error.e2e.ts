import { expect, test } from '../fixtures/test'

test(
  'unreadable session storage shows the route error screen and Refresh page recovers',
  { tag: '@both' },
  async ({ page, signInPage, sessionStorageFailure, routeErrorScreen }) => {
    await sessionStorageFailure.failReads()

    await page.reload()
    await routeErrorScreen.waitUntilShown()

    await expect.soft(routeErrorScreen.description).toBeVisible()
    await expect.soft(routeErrorScreen.refreshButton).toBeVisible()

    await sessionStorageFailure.restore()
    await routeErrorScreen.refresh()

    await expect(signInPage.heading).toBeVisible()
  },
)
