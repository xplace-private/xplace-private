import { LIMIT_REVIEW_CLIENT, PARTNER_REVIEW_CLIENT, SUSPENDED_CLIENT } from '../data/clients'
import { expect, test } from '../fixtures/test'

// First client of page 2 at 10 rows per page.
const PAGE_TWO_FIRST_EMAIL = 'partner11@example.test'

test('default clients page shows 10 of 47 records with status counts', { tag: '@both' }, async ({ homePage }) => {
  const { clients, filters } = homePage

  await expect.soft(clients.table.getByRole('columnheader')).toHaveText(['Email', 'Phone', 'Client name', 'Registration date', 'Status', 'Actions'])
  await expect.soft(clients.rows).toHaveCount(10)
  await expect.soft(clients.summary).toHaveText('Showing 10 of 47 clients')
  await expect.soft(filters.button('All')).toHaveText(/^All\s*47$/)
  await expect.soft(filters.button('Active')).toHaveText(/^Active\s*12$/)
  await expect.soft(filters.button('Onboarding')).toHaveText(/^Onboarding\s*6$/)
  await expect.soft(filters.button('Partner review')).toHaveText(/^Partner review\s*6$/)
  await expect.soft(filters.button('Limit review')).toHaveText(/^Limit review\s*5$/)
  await expect.soft(filters.button('Overdue')).toHaveText(/^Overdue\s*1$/)
  await expect.soft(filters.button('Suspended')).toHaveText(/^Suspended\s*2$/)
  await expect.soft(filters.button('Offboarding pending')).toHaveText(/^Offboarding pending\s*5$/)
  await expect.soft(filters.button('Closed')).toHaveText(/^Closed\s*5$/)
  await expect.soft(filters.button('Contact support')).toHaveText(/^Contact support\s*5$/)
  await expect.soft(clients.rows.first()).toContainText(SUSPENDED_CLIENT.email)
  await expect.soft(clients.rows.first()).toContainText('+1 (555) 666-7777')
  await expect.soft(clients.rows.first()).toContainText(SUSPENDED_CLIENT.name)
  await expect.soft(clients.rows.first()).toContainText('Feb 03, 2024')
  await expect.soft(clients.rows.first()).toContainText(SUSPENDED_CLIENT.status)
  await expect.soft(filters.button('All')).toHaveAttribute('aria-pressed', 'true')
})

test('search narrows clients and counts reflect search before the status filter', async ({ homePage }) => {
  const { clients, filters } = homePage

  await clients.search('David')

  await expect.soft(clients.summary).toHaveText('Showing 5 of 5 clients')
  await expect.soft(filters.button('All')).toHaveText(/^All\s*5$/)
  await expect.soft(filters.button('Active')).toHaveText(/^Active\s*0$/)
  await expect.soft(filters.button('Partner review')).toHaveText(/^Partner review\s*0$/)
  await expect.soft(filters.button('Overdue')).toHaveText(/^Overdue\s*1$/)
  await expect.soft(filters.button('Suspended')).toHaveText(/^Suspended\s*1$/)
  await expect.soft(filters.button('Offboarding pending')).toHaveText(/^Offboarding pending\s*1$/)
  await expect.soft(filters.button('Closed')).toHaveText(/^Closed\s*1$/)
  await expect.soft(filters.button('Contact support')).toHaveText(/^Contact support\s*1$/)

  await homePage.filterClientsBy('Overdue')

  await expect.soft(clients.rows).toHaveCount(1)
  await expect.soft(clients.rows.first()).toContainText('Overdue')
  await expect.soft(clients.summary).toHaveText('Showing 1 of 1 clients')
  await expect.soft(filters.button('Overdue')).toHaveAttribute('aria-pressed', 'true')
  await expect.soft(filters.button('All')).toHaveText(/^All\s*5$/)
})

test('no-match search shows the empty state and Clear filters resets the table', async ({ homePage }) => {
  const { clients, filters } = homePage

  await clients.search('zzz-no-match')

  await expect(clients.emptyState).toBeVisible()
  await expect(clients.clearFiltersButton).toBeVisible()

  await clients.clearFiltersButton.click()
  await clients.waitUntilLoaded()

  await expect.soft(clients.searchInput).toHaveValue('')
  await expect.soft(clients.summary).toHaveText('Showing 10 of 47 clients')
  await expect.soft(filters.button('All')).toHaveAttribute('aria-pressed', 'true')

  await clients.search('David')
  await homePage.filterClientsBy('Active')

  await expect(clients.emptyState).toBeVisible()
})

test('pagination moves between pages and disables bounds', async ({ homePage }) => {
  const { clients, pagination } = homePage

  await expect.soft(pagination.previousButton).toBeDisabled()
  await expect.soft(pagination.page(1)).toHaveAttribute('aria-current', 'page')

  await pagination.nextButton.click()
  await clients.waitUntilLoaded()

  await expect(clients.rows.first()).toContainText(PAGE_TWO_FIRST_EMAIL)

  await pagination.goToPage(4)
  await clients.waitUntilLoaded()

  await expect(clients.rows.first()).toContainText('partner31@example.test')

  await pagination.goToPage(5)
  await clients.waitUntilLoaded()

  await expect.soft(clients.rows).toHaveCount(7)
  await expect.soft(clients.summary).toHaveText('Showing 7 of 47 clients')
  await expect.soft(pagination.nextButton).toBeDisabled()
})

test('changing rows per page returns to page 1', async ({ homePage }) => {
  const { clients, pagination } = homePage

  await pagination.goToPage(2)
  await clients.waitUntilLoaded()
  await expect(pagination.page(2)).toHaveAttribute('aria-current', 'page')

  await clients.selectRowsPerPage(20)

  await expect.soft(clients.rowsPerPageButton).toContainText('20 rows')
  await expect.soft(pagination.page(1)).toHaveAttribute('aria-current', 'page')
  await expect.soft(clients.summary).toHaveText('Showing 20 of 47 clients')
  await expect.soft(clients.rows.nth(10)).toContainText(PAGE_TWO_FIRST_EMAIL)
})

test('changing the status filter returns to page 1', async ({ homePage }) => {
  const { clients, pagination } = homePage

  await pagination.goToPage(2)
  await clients.waitUntilLoaded()
  await homePage.filterClientsBy('Active')

  await expect.soft(clients.summary).toHaveText('Showing 10 of 12 clients')
  await expect.soft(pagination.page(1)).toHaveAttribute('aria-current', 'page')
})

test('70 rows per page shows every result on a single page', async ({ homePage }) => {
  const { clients, pagination } = homePage

  await clients.selectRowsPerPage(70)

  await expect.soft(clients.summary).toHaveText('Showing 47 of 47 clients')
  await expect.soft(clients.rows).toHaveCount(47)
  await expect.soft(pagination.nextButton).toBeDisabled()
  await expect.soft(pagination.previousButton).toBeDisabled()
})

test('compact pagination on mobile shows page status and icon buttons', { tag: '@mobile-only' }, async ({ homePage }) => {
  const { clients, pagination } = homePage

  await expect(pagination.compactStatus).toHaveText('Page 1 of 5')

  await pagination.nextButton.click()
  await clients.waitUntilLoaded()

  await expect.soft(pagination.compactStatus).toHaveText('Page 2 of 5')
  await expect.soft(pagination.page(2)).toBeHidden()
  await expect.soft(pagination.previousButton).toBeEnabled()

  await pagination.previousButton.click()
  await clients.waitUntilLoaded()

  await expect.soft(pagination.compactStatus).toHaveText('Page 1 of 5')
  await expect.soft(pagination.previousButton).toBeDisabled()
})

test('search matches phone digits regardless of formatting and email fragments in any case', async ({ homePage }) => {
  const { clients } = homePage

  await clients.search('555 777')

  await expect.soft(clients.summary).toHaveText('Showing 1 of 1 clients')
  await expect.soft(clients.rowOf(PARTNER_REVIEW_CLIENT)).toBeVisible()

  await clients.search('KRYPTON')

  await expect.soft(clients.summary).toHaveText('Showing 1 of 1 clients')
  await expect.soft(clients.rowOf(LIMIT_REVIEW_CLIENT)).toBeVisible()
})

test('ellipsis buttons and Previous navigate between pages', async ({ homePage }) => {
  const { clients, pagination } = homePage

  await expect(pagination.page(4)).toHaveText('…')

  await pagination.goToPage(4)
  await clients.waitUntilLoaded()

  await expect(pagination.page(4)).toHaveAttribute('aria-current', 'page')
  await expect(pagination.page(2)).toHaveText('…')

  await pagination.goToPage(2)
  await clients.waitUntilLoaded()

  await expect.soft(pagination.page(2)).toHaveAttribute('aria-current', 'page')
  await expect.soft(clients.rows.first()).toContainText(PAGE_TWO_FIRST_EMAIL)

  await pagination.previousButton.click()
  await clients.waitUntilLoaded()

  await expect.soft(pagination.page(1)).toHaveAttribute('aria-current', 'page')
  await expect.soft(clients.rows.first()).toContainText(SUSPENDED_CLIENT.email)
})

test('rows menu marks the selected option, closes on Escape and 100 rows shows everything', async ({ page, homePage }) => {
  const { clients } = homePage

  await clients.openRowsPerPageMenu()

  await expect(clients.rowsPerPageOption(10)).toHaveAttribute('aria-checked', 'true')

  await page.keyboard.press('Escape')

  await expect.soft(clients.rowsPerPageOption(10)).toBeHidden()
  await expect.soft(clients.rowsPerPageButton).toBeFocused()

  await clients.selectRowsPerPage(100)

  await expect.soft(clients.summary).toHaveText('Showing 47 of 47 clients')
  await expect.soft(clients.rowsPerPageButton).toContainText('100 rows')

  await clients.openRowsPerPageMenu()

  await expect.soft(clients.rowsPerPageOption(100)).toHaveAttribute('aria-checked', 'true')
  await expect.soft(clients.rowsPerPageOption(10)).toHaveAttribute('aria-checked', 'false')
})

test('Clear filters resets both the search and the status filter', async ({ homePage }) => {
  const { clients, filters } = homePage

  await clients.search('David')
  await homePage.filterClientsBy('Active')

  await expect(clients.emptyState).toBeVisible()

  await clients.clearFiltersButton.click()
  await clients.waitUntilLoaded()

  await expect.soft(clients.searchInput).toHaveValue('')
  await expect.soft(filters.button('All')).toHaveAttribute('aria-pressed', 'true')
  await expect.soft(clients.summary).toHaveText('Showing 10 of 47 clients')
})

test('All after a status filter restores the full list', async ({ homePage }) => {
  const { clients, filters } = homePage
  await homePage.filterClientsBy('Active')
  await expect(clients.summary).toHaveText('Showing 10 of 12 clients')

  await homePage.filterClientsBy('All')

  await expect.soft(clients.summary).toHaveText('Showing 10 of 47 clients')
  await expect.soft(filters.button('All')).toHaveAttribute('aria-pressed', 'true')
  await expect.soft(filters.button('Active')).toHaveAttribute('aria-pressed', 'false')
})

test('typing a search returns to page 1', async ({ homePage }) => {
  const { clients, pagination } = homePage

  await pagination.goToPage(2)
  await clients.waitUntilLoaded()
  await expect(pagination.page(2)).toHaveAttribute('aria-current', 'page')

  await clients.search('example.test')

  await expect.soft(pagination.page(1)).toHaveAttribute('aria-current', 'page')
  await expect.soft(clients.summary).toHaveText('Showing 10 of 38 clients')
})
