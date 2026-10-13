import { expect, type Locator, type Page } from '@playwright/test'

import type { ClientStatusLabel, KnownClient } from '../data/clients'
import { ClientActionsMenu } from './client-actions-menu'
import { PartnerReviewModal } from './partner-review-modal'
import { PaymentModal } from './payment-modal'

export type RowsPerPage = 10 | 20 | 70 | 100

export class ClientsTable {
  readonly table: Locator
  /** Wrapper that scrolls the wide table horizontally; it has no role or name, hence the parent step. */
  readonly scrollContainer: Locator
  readonly searchInput: Locator
  /** Data rows only: the header row and the aria-hidden skeleton rows are excluded. */
  readonly rows: Locator
  readonly summary: Locator
  readonly emptyState: Locator
  readonly clearFiltersButton: Locator
  readonly rowsPerPageButton: Locator
  /** The open row actions menu; open it with openMenu or from the keyboard. */
  readonly actionsMenu: ClientActionsMenu

  constructor(private readonly page: Page) {
    this.table = page.getByRole('table', { name: 'Clients' })
    this.scrollContainer = this.table.locator('..')
    this.searchInput = page.getByRole('searchbox', { name: 'Search by name, email or phone' })
    this.rows = this.table.getByRole('row').filter({ has: page.getByRole('cell') })
    this.summary = page.getByRole('status').filter({ hasText: /^Showing \d+ of \d+ clients$/ })
    this.emptyState = page.getByText('No clients found.')
    this.clearFiltersButton = page.getByRole('button', { name: 'Clear filters' })
    this.rowsPerPageButton = page.getByRole('button', { name: 'Rows per page' })
    this.actionsMenu = new ClientActionsMenu(page)
  }

  async waitUntilLoaded(): Promise<this> {
    await expect(this.table).toHaveAttribute('aria-busy', 'false')
    return this
  }

  /** The table turns busy on the first keystroke and idle after the debounce and the fetch. */
  async search(text: string): Promise<void> {
    await this.searchInput.fill(text)
    await this.waitUntilLoaded()
  }

  rowsPerPageOption(count: RowsPerPage): Locator {
    return this.page.getByRole('menuitemradio', { name: `${count} rows`, exact: true })
  }

  async openRowsPerPageMenu(): Promise<void> {
    await this.rowsPerPageButton.click()
    await expect(this.rowsPerPageOption(10)).toBeVisible()
  }

  async selectRowsPerPage(count: RowsPerPage): Promise<void> {
    await this.rowsPerPageButton.click()
    await this.rowsPerPageOption(count).click()
    await this.waitUntilLoaded()
  }

  /** Rows whose status cell differs from the given one, e.g. to check that a filter left no other status. */
  rowsWithoutStatus(status: ClientStatusLabel): Locator {
    return this.rows.filter({ hasNot: this.page.getByRole('cell', { name: status, exact: true }) })
  }

  rowOf(client: KnownClient): Locator {
    return this.rows
      .filter({ hasText: client.name })
      .filter({ hasText: client.email })
      .filter({ has: this.page.getByRole('cell', { name: client.status, exact: true }) })
  }

  actionsButtonOf(client: KnownClient): Locator {
    return this.rowOf(client).getByRole('button', { name: `Actions for ${client.name}` })
  }

  async openMenu(client: KnownClient): Promise<ClientActionsMenu> {
    await this.actionsButtonOf(client).click()
    return this.actionsMenu.waitUntilOpen()
  }

  paymentModalOf(client: KnownClient): PaymentModal {
    return new PaymentModal(this.page, client.name)
  }

  async openPayment(client: KnownClient): Promise<PaymentModal> {
    const menu = await this.openMenu(client)
    await menu.choose('Open')
    return this.paymentModalOf(client).waitUntilOpen()
  }

  async openPartnerReview(client: KnownClient): Promise<PartnerReviewModal> {
    const menu = await this.openMenu(client)
    await menu.choose('Open')
    return new PartnerReviewModal(this.page, client.name).waitUntilOpen()
  }
}
