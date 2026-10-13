import type { Locator, Page } from '@playwright/test'

import { ClientsTable } from '../components/clients-table'
import { Pagination } from '../components/pagination'
import { PortalHeader } from '../components/portal-header'
import { StatusFilters, type StatusFilterLabel } from '../components/status-filters'
import { BasePage } from './base-page'

export type ChartTitle = 'Spend Volume' | 'Commission earned'

export class HomePage extends BasePage {
  readonly heading: Locator
  readonly header: PortalHeader
  readonly filters: StatusFilters
  readonly clients: ClientsTable
  readonly pagination: Pagination

  constructor(page: Page) {
    super(page, '/home')
    this.heading = page.getByRole('heading', { name: 'Home', level: 1 })
    this.header = new PortalHeader(page)
    this.filters = new StatusFilters(page)
    this.clients = new ClientsTable(page)
    this.pagination = new Pagination(page)
  }

  /**
   * A KPI card by its title, e.g. "Total Spend Volume" or "Active clients".
   * The cards have no accessible name, so the section is found through its heading.
   */
  metricCard(title: string): Locator {
    return this.page.locator('section').filter({ has: this.page.getByRole('heading', { name: title, exact: true }) })
  }

  chart(title: ChartTitle): Locator {
    return this.page.getByRole('region', { name: title, exact: true })
  }

  /** Hovers the first month's bar of a chart to open its tooltip. */
  async hoverFirstMonth(title: ChartTitle): Promise<void> {
    await this.chart(title).getByRole('application', { name: title }).hover({ position: { x: 8, y: 100 } })
  }

  async filterClientsBy(label: StatusFilterLabel): Promise<void> {
    await this.filters.filterBy(label)
    await this.clients.waitUntilLoaded()
  }
}
