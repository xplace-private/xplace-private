import { PARTNER } from '../data/clients'
import { expect, test } from '../fixtures/test'

test('Profile shows placeholders until the account loads', async ({ page, unopenedProfilePage }) => {
  await page.clock.install({ time: new Date('2026-10-01T09:00:00') })
  await page.clock.pauseAt(new Date('2026-10-01T09:00:01'))

  await unopenedProfilePage.open()

  await expect.soft(unopenedProfilePage.field('Full name')).toHaveText('Full name')
  await expect.soft(unopenedProfilePage.field('Email address')).toHaveText('Email address')
  await expect.soft(unopenedProfilePage.field('Phone number')).toHaveText('Phone number')
  await expect.soft(unopenedProfilePage.field('Company')).toHaveText('Company')

  await page.clock.runFor(500)

  await expect.soft(unopenedProfilePage.field('Full name')).toContainText(PARTNER.fullName)
  await expect.soft(unopenedProfilePage.field('Email address')).toContainText(PARTNER.email)
  await expect.soft(unopenedProfilePage.field('Phone number')).toContainText(PARTNER.phone)
  await expect.soft(unopenedProfilePage.field('Company')).toContainText(PARTNER.company)
})
