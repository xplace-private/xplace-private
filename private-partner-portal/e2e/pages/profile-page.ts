import type { Locator, Page } from '@playwright/test'

import { ChangePasswordModal } from '../components/change-password-modal'
import { PortalHeader } from '../components/portal-header'
import { BasePage } from './base-page'

export class ProfilePage extends BasePage {
  readonly heading: Locator
  readonly header: PortalHeader
  readonly changePasswordButton: Locator
  readonly signOutAllSessionsButton: Locator
  readonly supportLink: Locator

  constructor(page: Page) {
    super(page, '/profile')
    this.heading = page.getByRole('heading', { name: 'Partner Profile' })
    this.header = new PortalHeader(page)
    this.changePasswordButton = page.getByRole('button', { name: 'Change Password', exact: true })
    this.signOutAllSessionsButton = page.getByRole('button', { name: 'Sign out all sessions' })
    this.supportLink = page.getByRole('region', { name: 'Need to change account details?' }).getByRole('link')
  }

  /**
   * Container of an account field by its label, e.g. "Email address": assert its text with toContainText.
   * Labels are plain spans without a programmatic link to the value, hence the parent step.
   * "Company" is rendered twice by the product (bug DEV-3313), so the first one is taken.
   */
  field(label: string): Locator {
    return this.page.getByText(label, { exact: true }).first().locator('..')
  }

  async changePassword(): Promise<ChangePasswordModal> {
    await this.changePasswordButton.click()
    return new ChangePasswordModal(this.page).waitUntilOpen()
  }
}
