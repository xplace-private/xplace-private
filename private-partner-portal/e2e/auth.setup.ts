import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { expect, test as setup } from '@playwright/test'

import { SUSPENDED_CLIENT } from './data/clients'
import { MOCK_SESSION_KEY, SESSION_FILE } from './data/session'
import { TEST_USER } from './data/users'
import { AuthFlow } from './flows/auth-flow'

setup('complete the initial setup and save the session', async ({ page }) => {
  const homePage = await new AuthFlow(page).completeInitialSetup(TEST_USER)

  // The mock session lives in sessionStorage, which Playwright does not persist in storageState.
  const sessionStorage = await page.evaluate(() => JSON.stringify(window.sessionStorage))
  expect(JSON.parse(sessionStorage)).toMatchObject({ [MOCK_SESSION_KEY]: 'authenticated' })
  await mkdir(dirname(SESSION_FILE), { recursive: true })
  await writeFile(SESSION_FILE, sessionStorage)

  // Warm up the lazily loaded modules (payment modal, crypto QR code): the Vite dev server may
  // reload the page when it first optimizes their dependencies, which would disturb the first tests.
  await homePage.open()
  await homePage.clients.waitUntilLoaded()
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)
  await payment.selectMethod('Crypto')
  await expect(payment.qrCode).toBeVisible()
})
