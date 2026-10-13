import {
  ACTIVE_CLIENT,
  CLOSED_CLIENT,
  CONTACT_SUPPORT_CLIENT,
  LIMIT_REVIEW_CLIENT,
  NULL_DETAILS_CLIENT,
  OFFBOARDING_CLIENT,
  ONBOARDING_CLIENT,
  OVERDUE_CLIENT,
  PARTNER_REVIEW_CLIENT,
  STATUS_CLIENTS,
  STATUS_COUNTS,
  SUPPORT_URL,
  SUSPENDED_CLIENT,
  UNDATED_CLOSED_CLIENT,
  UNDATED_OFFBOARDING_CLIENT,
} from '../data/clients'
import { DUE_DATE, PROOF_DESCRIPTION, PROOF_EMAIL, PROOF_TITLE, STATEMENT_OWED, UNKNOWN, USD_TRANSFER } from '../data/payment'
import type { PaymentModal } from '../components/payment-modal'
import { expect, test } from '../fixtures/test'

const FIRST_PAGE_SIZE = 10
const CLOSED_NOTICE_TAIL = 'The card has been cancelled and no further transactions can be made.'
const USD_COPY_LABELS = [...USD_TRANSFER.map(([label]) => label), 'Email']

async function expectProofOfPayment(payment: PaymentModal): Promise<void> {
  await expect.soft(payment.proofNotice).toContainText(PROOF_TITLE)
  await expect.soft(payment.proofNotice).toContainText(PROOF_DESCRIPTION)
  await expect.soft(payment.emailSection).toContainText(PROOF_EMAIL)
  await expect.soft(payment.copyButton('Email')).toBeEnabled()
}

async function expectUnavailableDetails(payment: PaymentModal): Promise<void> {
  await expect.soft(payment.methodTabs).toHaveCount(0)
  for (const label of USD_COPY_LABELS) {
    await expect.soft(payment.copyButton(label)).toBeDisabled()
  }
  for (const [label] of USD_TRANSFER) {
    await expect.soft(payment.detailRow(label)).toContainText(UNKNOWN)
  }
  await expect.soft(payment.emailSection).toContainText(UNKNOWN)
}

test('the first clients page shows one row per status with its badge', { tag: '@both' }, async ({ homePage }) => {
  const { clients } = homePage

  await expect(clients.rows).toHaveCount(FIRST_PAGE_SIZE)
  for (const client of STATUS_CLIENTS) {
    await expect.soft(clients.rowOf(client)).toHaveCount(1)
  }
})

test('each status filter lists only clients with that status', async ({ homePage }) => {
  const { clients, filters } = homePage

  for (const { status, total } of STATUS_COUNTS) {
    await homePage.filterClientsBy(status)

    await expect.soft(filters.button(status)).toHaveAttribute('aria-pressed', 'true')
    await expect.soft(clients.summary).toHaveText(`Showing ${Math.min(total, FIRST_PAGE_SIZE)} of ${total} clients`)
    await expect.soft(clients.rowsWithoutStatus(status)).toHaveCount(0)
  }
})

for (const client of [SUSPENDED_CLIENT, OVERDUE_CLIENT, OFFBOARDING_CLIENT, PARTNER_REVIEW_CLIENT]) {
  test(`${client.status} client menu offers a single Open item and closes on an outside click`, { tag: '@both' }, async ({ homePage }) => {
    const menu = await homePage.clients.openMenu(client)

    await expect.soft(menu.items).toHaveText(['Open'])

    await menu.closeByClickingOutside()

    await expect(menu.menu).toBeHidden()
  })
}

const SUPPORT_MENUS = [
  { client: ACTIVE_CLIENT, items: ['AUM review', 'Request offboarding'] },
  { client: CONTACT_SUPPORT_CLIENT, items: ['Contact Support'] },
]

for (const { client, items } of SUPPORT_MENUS) {
  test(`${client.status} client menu opens on touch devices and closes on an outside tap`, { tag: '@mobile-only' }, async ({ homePage }) => {
    const menu = await homePage.clients.openMenu(client)

    await expect.soft(menu.items).toHaveText(items)

    await menu.closeByClickingOutside()

    await expect(menu.menu).toBeHidden()
  })
}

const INFO_MENUS = [
  {
    client: LIMIT_REVIEW_CLIENT,
    title: 'A credit limit is being set up for the client.',
    description: 'The account will be activated soon.',
  },
  {
    client: ONBOARDING_CLIENT,
    title: 'The client has not completed the onboarding process.',
    description: 'The user started the KYC process but did not finish.',
  },
  {
    client: CLOSED_CLIENT,
    title: 'Account closed.',
    description: `The client's account was closed on 12 September. ${CLOSED_NOTICE_TAIL}`,
  },
]

for (const { client, title, description } of INFO_MENUS) {
  test(`${client.status} client menu focuses the status details and exposes them as name and description`, async ({ homePage }) => {
    const menu = await homePage.clients.openMenu(client)

    await expect.soft(menu.infoGroup).toBeFocused()
    await expect.soft(menu.infoGroup).toHaveAccessibleName(title)
    await expect.soft(menu.infoGroup).toHaveAccessibleDescription(description)
  })
}

for (const { client, title } of INFO_MENUS) {
  test(`${client.status} client menu shows details on touch devices and closes on an outside tap`, { tag: '@mobile-only' }, async ({ homePage }) => {
    const menu = await homePage.clients.openMenu(client)

    await expect.soft(menu.infoGroup).toHaveAccessibleName(title)
    await expect.soft(menu.items).toHaveCount(0)

    await menu.closeByClickingOutside()

    await expect(menu.menu).toBeHidden()
  })
}

test('an info menu opens from the keyboard with its details focused', async ({ homePage }) => {
  const { clients } = homePage

  await clients.actionsButtonOf(ONBOARDING_CLIENT).press('Enter')
  const menu = await clients.actionsMenu.waitUntilOpen()

  await expect(menu.infoGroup).toBeFocused()
})

test('a closed client without a closing date shows an unknown date', async ({ homePage }) => {
  const { clients } = homePage
  await clients.search(UNDATED_CLOSED_CLIENT.email)

  await expect(clients.rowOf(UNDATED_CLOSED_CLIENT)).toBeVisible()

  const menu = await clients.openMenu(UNDATED_CLOSED_CLIENT)

  await expect(menu.infoGroup).toHaveAccessibleDescription(`The client's account was closed on ${UNKNOWN}. ${CLOSED_NOTICE_TAIL}`)
})

test(
  'overdue modal shows badge, statement, the notice after it, transfer details and proof banner, and Back closes it',
  { tag: '@both' },
  async ({ homePage }) => {
    const { clients } = homePage

    const payment = await clients.openPayment(OVERDUE_CLIENT)

    await expect.soft(payment.badge('Overdue')).toBeVisible()
    await expect.soft(payment.detailRow('Statement owed')).toContainText(STATEMENT_OWED)
    await expect.soft(payment.detailRow('Due date')).toContainText(DUE_DATE)
    await expect.soft(payment.notice('Payment overdue')).toBeVisible()
    expect.soft(await payment.noticePrecedesStatement('Payment overdue')).toBe(false)
    await expect.soft(payment.methodTab('USD')).toHaveAttribute('aria-selected', 'true')
    await expect.soft(payment.methodTab('EUR')).toBeEnabled()
    await expect.soft(payment.methodTab('Crypto')).toBeEnabled()
    for (const [label, value] of USD_TRANSFER) {
      await expect.soft(payment.detailRow(label)).toContainText(value)
    }
    await expectProofOfPayment(payment)
    await expect.soft(payment.contactTeamLink).toHaveCount(0)
    await expect.soft(payment.closeButton).toHaveCount(1)

    await payment.goBack()

    await expect(payment.dialog).toBeHidden()
    await expect(clients.actionsButtonOf(OVERDUE_CLIENT)).toBeFocused()
  },
)

test('offboarding modal leads with the closure notice and offers Contact Team and Close', { tag: '@both' }, async ({ homePage }) => {
  const { clients } = homePage

  const payment = await clients.openPayment(OFFBOARDING_CLIENT)

  await expect.soft(payment.badge('Offboarding pending')).toBeVisible()
  await expect.soft(payment.notice('Account closed – balance outstanding')).toBeVisible()
  expect.soft(await payment.noticePrecedesStatement('Account closed – balance outstanding')).toBe(true)
  await expect.soft(payment.detailRow('Statement owed')).toContainText(STATEMENT_OWED)
  await expect.soft(payment.detailRow('Due date')).toContainText(DUE_DATE)
  await expectProofOfPayment(payment)
  await expect.soft(payment.contactTeamLink).toHaveAttribute('href', SUPPORT_URL)
  await expect.soft(payment.contactTeamLink).toHaveAttribute('target', '_blank')
  await expect.soft(payment.contactTeamLink).toHaveAttribute('rel', 'noopener noreferrer')
  await expect.soft(payment.closeButton).toBeVisible()

  await payment.goBack()

  await expect(payment.dialog).toBeHidden()
  await expect(clients.actionsButtonOf(OFFBOARDING_CLIENT)).toBeFocused()
})

test('suspended modal shows the proof-of-payment banner and an enabled Copy Email without Contact Team', { tag: '@both' }, async ({ homePage }) => {
  const payment = await homePage.clients.openPayment(SUSPENDED_CLIENT)

  await expectProofOfPayment(payment)
  await expect(payment.contactTeamLink).toHaveCount(0)
})

test('a suspended client without payment details shows unknown values and disabled Copy buttons', { tag: '@both' }, async ({ homePage }) => {
  const { clients } = homePage
  await clients.search(NULL_DETAILS_CLIENT.email)

  await expect.soft(clients.rowOf(NULL_DETAILS_CLIENT)).toContainText(NULL_DETAILS_CLIENT.phone)
  await expect.soft(clients.rowOf(NULL_DETAILS_CLIENT)).toContainText(NULL_DETAILS_CLIENT.registered)

  const payment = await clients.openPayment(NULL_DETAILS_CLIENT)
  const notice = payment.notice('Account suspended')

  await expect.soft(payment.badge('Suspended')).toBeVisible()
  await expect.soft(payment.detailRow('Statement owed')).toContainText(NULL_DETAILS_CLIENT.statementOwed)
  await expect.soft(payment.detailRow('Due date')).toContainText(UNKNOWN)
  await expect.soft(notice).toContainText(`The client's card was suspended on ${UNKNOWN} due to an unpaid balance of ${UNKNOWN}. Late fees continue to accrue daily.`)
  await expect.soft(notice).toContainText(`Pay ${UNKNOWN} to clear the balance and reactivate the card.`)
  await expectUnavailableDetails(payment)
  await expect.soft(payment.proofNotice).toBeVisible()

  await payment.close()

  await expect(payment.dialog).toBeHidden()
})

test('an offboarding client without payment details or closing date shows unknown values', async ({ homePage }) => {
  const { clients } = homePage
  await clients.search(UNDATED_OFFBOARDING_CLIENT.email)

  const payment = await clients.openPayment(UNDATED_OFFBOARDING_CLIENT)
  const notice = payment.notice('Account closed – balance outstanding')

  await expect.soft(payment.badge('Offboarding pending')).toBeVisible()
  await expect.soft(payment.detailRow('Statement owed')).toContainText(UNKNOWN)
  await expect.soft(payment.detailRow('Due date')).toContainText(UNKNOWN)
  await expect.soft(notice).toContainText(
    `The client's account was closed on ${UNKNOWN} with an unpaid balance of ${UNKNOWN} as of ${UNKNOWN}. Late fees continue to accrue daily until the balance is settled.`,
  )
  await expect.soft(notice).toContainText(`Pay ${UNKNOWN} on the client's behalf.`)
  await expectUnavailableDetails(payment)
  await expect.soft(payment.contactTeamLink).toBeVisible()
})
