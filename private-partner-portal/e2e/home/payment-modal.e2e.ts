import { OFFBOARDING_CLIENT, OVERDUE_CLIENT, SUSPENDED_CLIENT } from '../data/clients'
import { DEPOSIT_ADDRESS, DUE_DATE, EUR_TRANSFER, PROOF_EMAIL, STATEMENT_OWED, USD_TRANSFER } from '../data/payment'
import { expect, test } from '../fixtures/test'

test('Open on a suspended client shows payment details and Close restores focus', { tag: '@both' }, async ({ homePage }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)

  await expect.soft(payment.badge('Suspended')).toBeVisible()
  await expect.soft(payment.detailRow('Statement owed')).toContainText(STATEMENT_OWED)
  await expect.soft(payment.detailRow('Due date')).toContainText(DUE_DATE)
  await expect.soft(payment.notice('Account suspended')).toContainText(
    "The client's card was suspended on 9 September due to an unpaid balance of USD 3,034.90. Late fees continue to accrue daily.",
  )
  await expect.soft(payment.notice('Account suspended')).toContainText('Pay USD 3,084.90 to clear the balance and reactivate the card.')
  await expect.soft(payment.methodTab('USD')).toHaveAttribute('aria-selected', 'true')
  for (const [label, value] of USD_TRANSFER) {
    await expect.soft(payment.detailRow(label)).toContainText(value)
  }
  await expect.soft(payment.dialog.getByText(PROOF_EMAIL)).toBeVisible()

  await payment.close()

  await expect(payment.dialog).toBeHidden()
  await expect(homePage.clients.actionsButtonOf(SUSPENDED_CLIENT)).toBeFocused()
})

test('switching payment method shows EUR and crypto transfer details', async ({ homePage }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)

  await payment.selectMethod('EUR')

  await expect.soft(payment.methodTab('EUR')).toHaveAttribute('aria-selected', 'true')
  await expect.soft(payment.methodTab('USD')).toHaveAttribute('aria-selected', 'false')
  await expect.soft(payment.dialog.getByRole('region', { name: 'EUR rates' })).toContainText('1 USD = 0.8807 EUR')
  await expect.soft(payment.dialog.getByRole('region', { name: 'EUR rates' })).toContainText('EUR 440.24')
  for (const [label, value] of EUR_TRANSFER) {
    await expect.soft(payment.detailRow(label)).toContainText(value)
  }
  await expect.soft(payment.copyButton('BIC')).toBeVisible()
  await expect.soft(payment.copyButton('SWIFT')).toHaveCount(0)

  await payment.selectMethod('Crypto')

  await expect.soft(payment.methodTab('Crypto')).toHaveAttribute('aria-selected', 'true')
  await expect.soft(payment.methodTab('EUR')).toHaveAttribute('aria-selected', 'false')
  await expect.soft(payment.dialog.getByText(/^Send USDC on the ERC-20 network/)).toBeVisible()
  await expect.soft(payment.qrCode).toBeVisible()
  await expect.soft(payment.dialog.getByText(DEPOSIT_ADDRESS)).toBeVisible()
  await expect.soft(payment.copyButton('Deposit address')).toBeVisible()
  await expect.soft(payment.copyButton('IBAN')).toHaveCount(0)

  await payment.selectMethod('USD')

  await expect.soft(payment.methodTab('USD')).toHaveAttribute('aria-selected', 'true')
  await expect.soft(payment.methodTab('Crypto')).toHaveAttribute('aria-selected', 'false')
  for (const [label, value] of USD_TRANSFER) {
    await expect.soft(payment.detailRow(label)).toContainText(value)
  }
})

test('payment method tabs support arrow, Home and End keys', async ({ homePage, page }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)
  await payment.methodTab('USD').focus()

  await page.keyboard.press('ArrowRight')

  await expect(payment.methodTab('EUR')).toBeFocused()
  await expect(payment.methodTab('EUR')).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowRight')

  await expect(payment.methodTab('Crypto')).toBeFocused()
  await expect(payment.methodTab('Crypto')).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowRight')

  await expect(payment.methodTab('USD')).toBeFocused()
  await expect(payment.methodTab('USD')).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('End')

  await expect(payment.methodTab('Crypto')).toBeFocused()
  await expect(payment.methodTab('Crypto')).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('Home')

  await expect(payment.methodTab('USD')).toBeFocused()
  await expect(payment.methodTab('USD')).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowLeft')

  await expect(payment.methodTab('Crypto')).toBeFocused()
  await expect(payment.methodTab('Crypto')).toHaveAttribute('aria-selected', 'true')
})

test('overdue and offboarding-pending clients show their own notice and can be closed', async ({ homePage }) => {
  const overdue = await homePage.clients.openPayment(OVERDUE_CLIENT)

  await expect.soft(overdue.notice('Payment overdue')).toContainText(
    'USD 3,034.90 was not paid by the due date. A late fee of 2.99% per month (minimum USD 50) is accruing daily. The client\'s card will be suspended on 9 September if the balance remains unpaid.',
  )
  await expect.soft(overdue.notice('Payment overdue')).toContainText("Pay USD 3,084.90 on the client's behalf")

  await overdue.pressEscape()

  await expect(overdue.dialog).toBeHidden()

  const offboarding = await homePage.clients.openPayment(OFFBOARDING_CLIENT)

  await expect.soft(offboarding.notice('Account closed – balance outstanding')).toContainText(
    "The client's account was closed on 12 September with an unpaid balance of USD 3,084.90 as of 29 September. Late fees continue to accrue daily until the balance is settled.",
  )
  await expect.soft(offboarding.notice('Account closed – balance outstanding')).toContainText("Pay USD 3,084.90 on the client's behalf.")

  await offboarding.close()

  await expect(offboarding.dialog).toBeHidden()
})

test('payment dialog traps focus, hides the page behind it and closes on Escape or outside click', async ({ homePage, page }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)

  await expect.soft(payment.dialog).toBeFocused()

  await page.keyboard.press('Tab')

  await expect(payment.backButton).toBeFocused()

  await page.keyboard.press('Shift+Tab')

  await expect(payment.closeButton).toBeFocused()
  await expect(homePage.header.logOutButton).toHaveCount(0)

  await payment.pressEscape()

  await expect(payment.dialog).toBeHidden()
  await expect(homePage.clients.actionsButtonOf(SUSPENDED_CLIENT)).toBeFocused()

  const reopened = await homePage.clients.openPayment(SUSPENDED_CLIENT)

  await reopened.closeByClickingOutside()

  await expect(reopened.dialog).toBeHidden()
})
