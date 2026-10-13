import { PARTNER } from '../data/clients'
import { expect, test } from '../fixtures/test'

test('Home shows loading placeholders until the data arrives', async ({ page, unopenedHomePage }) => {
  await page.clock.install({ time: new Date('2026-10-01T09:00:00') })
  await page.clock.pauseAt(new Date('2026-10-01T09:00:01'))

  await unopenedHomePage.open()

  await expect.soft(unopenedHomePage.clients.table).toHaveAttribute('aria-busy', 'true')
  await expect.soft(unopenedHomePage.clients.rows).toHaveCount(0)
  await expect.soft(unopenedHomePage.filters.button('All')).toHaveAccessibleName(/^All\s*—$/)
  await expect.soft(unopenedHomePage.pagination.previousButton).toBeDisabled()
  await expect.soft(unopenedHomePage.pagination.nextButton).toBeDisabled()
  await expect.soft(unopenedHomePage.header.companyButton).toHaveCount(0)
  await expect.soft(unopenedHomePage.metricCard('Total Spend Volume')).toHaveAttribute('aria-busy', 'true')
  await expect.soft(unopenedHomePage.chart('Spend Volume')).toHaveAttribute('aria-busy', 'true')

  await page.clock.runFor(500)

  await unopenedHomePage.clients.waitUntilLoaded()
  await expect.soft(unopenedHomePage.clients.summary).toHaveText('Showing 10 of 47 clients')
  await expect.soft(unopenedHomePage.header.companyButton).toHaveText(PARTNER.company)
  await expect.soft(unopenedHomePage.metricCard('Total Spend Volume')).toHaveAttribute('aria-busy', 'false')
})
