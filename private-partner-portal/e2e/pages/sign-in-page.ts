import type { Locator, Page } from '@playwright/test'

import type { TestUser } from '../data/users'
import { AuthenticatorPage } from './authenticator-page'
import { BasePage } from './base-page'

export class SignInPage extends BasePage {
  readonly heading: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly signInButton: Locator
  readonly forgotPasswordButton: Locator
  readonly alerts: Locator

  constructor(page: Page) {
    super(page, '/auth/sign-in')
    this.heading = page.getByRole('heading', { name: 'Sign In' })
    this.emailInput = page.getByLabel('Email', { exact: true })
    this.passwordInput = page.getByLabel('Password', { exact: true })
    this.signInButton = page.getByRole('button', { name: 'Sign In', exact: true })
    this.forgotPasswordButton = page.getByRole('button', { name: 'Forgot your password?' })
    this.alerts = page.getByRole('alert')
  }

  /** Submits the form and stays on the page, e.g. to check validation errors. */
  async submit(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.signInButton.click()
  }

  /** Submits the form from the keyboard (Enter in the password field), like a real user. */
  async submitWithEnter(user: TestUser): Promise<AuthenticatorPage> {
    await this.emailInput.fill(user.email)
    await this.passwordInput.fill(user.password)
    await this.passwordInput.press('Enter')
    return new AuthenticatorPage(this.page, 'setup').waitUntilLoaded()
  }

  /** First sign-in of the tab: leads to the authenticator setup. */
  async signIn(user: TestUser): Promise<AuthenticatorPage> {
    await this.submit(user.email, user.password)
    return new AuthenticatorPage(this.page, 'setup').waitUntilLoaded()
  }

  /** Sign-in after a logout in the same tab: leads to the 2FA verification. */
  async signInReturning(user: TestUser): Promise<AuthenticatorPage> {
    await this.submit(user.email, user.password)
    return new AuthenticatorPage(this.page, 'twoFactor').waitUntilLoaded()
  }
}
