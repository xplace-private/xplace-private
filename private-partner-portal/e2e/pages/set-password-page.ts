import type { Locator, Page } from '@playwright/test'

import { BasePage } from './base-page'
import { HomePage } from './home-page'

export class SetPasswordPage extends BasePage {
  readonly heading: Locator
  readonly passwordInput: Locator
  readonly confirmationInput: Locator
  readonly submitButton: Locator
  readonly alerts: Locator

  constructor(page: Page) {
    super(page, '/auth/set-password')
    this.heading = page.getByRole('heading', { name: 'Set Your Password' })
    this.passwordInput = page.getByLabel('New Password', { exact: true })
    this.confirmationInput = page.getByLabel('Confirm New Password', { exact: true })
    this.submitButton = page.getByRole('button', { name: 'Set Password & Continue' })
    this.alerts = page.getByRole('alert')
  }

  /** Submits the form and stays on the page, e.g. to check validation errors. */
  async submit(password: string, confirmation: string): Promise<void> {
    await this.passwordInput.fill(password)
    await this.confirmationInput.fill(confirmation)
    await this.submitButton.click()
  }

  async setPassword(password: string, confirmation = password): Promise<HomePage> {
    await this.submit(password, confirmation)
    return new HomePage(this.page).waitUntilLoaded()
  }
}
