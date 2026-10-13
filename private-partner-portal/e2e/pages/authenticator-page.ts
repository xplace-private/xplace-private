import type { Locator, Page } from '@playwright/test'

import { BasePage } from './base-page'
import { HomePage } from './home-page'
import { SetPasswordPage } from './set-password-page'

/** 'setup' is the first sign-in (steps and "Open in Authenticator App"); 'twoFactor' is a repeat sign-in. */
export type AuthenticatorVariant = 'setup' | 'twoFactor'

export class AuthenticatorPage extends BasePage {
  readonly heading: Locator
  readonly setupSteps: Locator
  readonly openInAppButton: Locator
  readonly codeInput: Locator
  readonly continueButton: Locator
  readonly errorAlert: Locator
  readonly hint: Locator

  constructor(page: Page, variant: AuthenticatorVariant) {
    super(page, '/auth/authenticator')
    this.heading = page.getByRole('heading', { name: variant === 'setup' ? 'Set Up Authenticator' : '2FA authentication' })
    this.setupSteps = page.getByRole('main').getByRole('listitem')
    this.openInAppButton = page.getByRole('button', { name: 'Open in Authenticator App' })
    this.codeInput = page.getByLabel('Code from authenticator app')
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true })
    this.errorAlert = page.getByRole('alert')
    this.hint = page.getByText('iPhone may open Apple Password. For other apps, copy the key.')
  }

  /** Submits the code and stays on the page, e.g. to check validation errors. */
  async submitCode(code: string): Promise<void> {
    await this.codeInput.fill(code)
    await this.continueButton.click()
  }

  /** Setup variant: a correct code leads to the password step. */
  async verify(code: string): Promise<SetPasswordPage> {
    await this.submitCode(code)
    return new SetPasswordPage(this.page).waitUntilLoaded()
  }

  /** Two-factor variant: a correct code leads straight to Home. */
  async verifyReturning(code: string): Promise<HomePage> {
    await this.submitCode(code)
    return new HomePage(this.page).waitUntilLoaded()
  }
}
