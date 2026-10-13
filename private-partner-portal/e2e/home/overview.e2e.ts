import { PARTNER } from '../data/clients'
import { expect, test } from '../fixtures/test'

test('Home shows the partner header, KPI values and both chart panels', { tag: '@both' }, async ({ page, homePage }) => {
  const { header } = homePage

  await expect.soft(header.homeLogo).toBeVisible()
  await expect.soft(header.companyButton).toHaveText(PARTNER.company)
  await expect.soft(header.logOutButton).toBeVisible()
  await expect.soft(page.getByText('PARTNER PORTAL')).toBeVisible()
  await expect.soft(homePage.metricCard('Total Spend Volume').getByText('$2,847,392', { exact: true })).toBeVisible()
  await expect.soft(homePage.metricCard('Commission earned').getByText('$142,369', { exact: true })).toBeVisible()
  await expect.soft(homePage.metricCard('Commission earned')).toContainText('Available for payout: $1,230')
  await expect.soft(homePage.metricCard('Number of purchases').getByText('142', { exact: true })).toBeVisible()
  await expect.soft(homePage.metricCard('Number of purchases')).toContainText('120 completed')
  await expect.soft(homePage.metricCard('Number of purchases')).toContainText('22 pending')
  await expect.soft(homePage.metricCard('Avg purchase value').getByText('$120.98', { exact: true })).toBeVisible()
  await expect.soft(homePage.metricCard('Active clients').getByText('12', { exact: true })).toBeVisible()
  await expect.soft(homePage.metricCard('Active clients')).toContainText('1 overdue')
  await expect.soft(homePage.metricCard('Active clients')).toContainText('2 suspended')

  for (const title of ['Spend Volume', 'Commission earned'] as const) {
    const chart = homePage.chart(title)

    await expect.soft(chart).toContainText('monthly, 12 months')
    await expect.soft(chart.getByRole('alert')).toHaveCount(0)
    await expect.soft(chart.getByText('No monthly activity available.')).toHaveCount(0)
    // The plot is an "application" whose text is the X axis: real bars render, not a placeholder.
    await expect.soft(chart.getByRole('application', { name: title })).toContainText('JAN')
    await expect.soft(chart.getByRole('application', { name: title })).toContainText('DEC')
  }
})

test('hovering a chart month shows its value in a tooltip', async ({ homePage }) => {
  await homePage.hoverFirstMonth('Spend Volume')

  await expect.soft(homePage.chart('Spend Volume')).toContainText('Jan')
  await expect.soft(homePage.chart('Spend Volume')).toContainText('$107,143')

  await homePage.hoverFirstMonth('Commission earned')

  await expect.soft(homePage.chart('Commission earned')).toContainText('$51,020')
})
