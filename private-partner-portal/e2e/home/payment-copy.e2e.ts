import { SUSPENDED_CLIENT } from '../data/clients'
import { DEPOSIT_ADDRESS, EUR_TRANSFER, PROOF_EMAIL, USD_TRANSFER } from '../data/payment'
import { expect, test } from '../fixtures/test'

test('every Copy button in each payment method copies its value', async ({ homePage, page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText())
  const methods = [
    { method: 'USD', rows: [...USD_TRANSFER, ['Email', PROOF_EMAIL]] },
    { method: 'EUR', rows: [...EUR_TRANSFER, ['Email', PROOF_EMAIL]] },
    { method: 'Crypto', rows: [['Deposit address', DEPOSIT_ADDRESS], ['Email', PROOF_EMAIL]] },
  ] as const

  for (const { method, rows } of methods) {
    await payment.selectMethod(method)

    for (const [label, value] of rows) {
      await payment.copy(label)

      await expect.poll(clipboard, { message: `${method}: Copy ${label}` }).toBe(value)
      await expect.soft(homePage.toast.withText('COPIED').first(), `${method}: Copy ${label}`).toBeVisible()
    }
  }
})

test('every Copy button is enabled in each payment method', { tag: '@both' }, async ({ homePage }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)
  const methods = [
    { method: 'USD', labels: [...USD_TRANSFER.map(([label]) => label), 'Email'] },
    { method: 'EUR', labels: [...EUR_TRANSFER.map(([label]) => label), 'Email'] },
    { method: 'Crypto', labels: ['Deposit address', 'Email'] },
  ] as const

  for (const { method, labels } of methods) {
    await payment.selectMethod(method)

    await expect.soft(payment.copyButtons, method).toHaveCount(labels.length)
    for (const label of labels) {
      await expect.soft(payment.copyButton(label), `${method}: Copy ${label}`).toBeEnabled()
    }
  }
})

test('a failed copy shows an error toast', { tag: '@both' }, async ({ homePage, page }) => {
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'))
  })
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)

  await payment.copy('IBAN')

  await expect(homePage.toast.withText('Unable to copy. Please try again.')).toBeVisible()
  await expect(homePage.toast.withText('COPIED')).toHaveCount(0)
})
