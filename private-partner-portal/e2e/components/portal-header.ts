import type { Locator, Page } from '@playwright/test'

import { ProfilePage } from '../pages/profile-page'
import { SignInPage } from '../pages/sign-in-page'

export class PortalHeader {
  readonly homeLogo: Locator
  /** The only header button that shows text other than "Log Out". */
  readonly companyButton: Locator
  readonly logOutButton: Locator
  /** The sign-out failure message, rendered next to the Log Out button. */
  readonly signOutError: Locator

  constructor(private readonly page: Page) {
    const header = page.getByRole('banner')
    this.homeLogo = header.getByRole('button', { name: 'Home', exact: true })
    this.logOutButton = header.getByRole('button', { name: 'Log Out', exact: true })
    this.signOutError = header.getByRole('alert')
    this.companyButton = header.getByRole('button').filter({ hasText: /\S/ }).filter({ hasNotText: 'Log Out' })
  }

  async logOut(): Promise<SignInPage> {
    await this.logOutButton.click()
    return new SignInPage(this.page).waitUntilLoaded()
  }

  async openProfile(): Promise<ProfilePage> {
    await this.companyButton.click()
    return new ProfilePage(this.page).waitUntilLoaded()
  }
}
