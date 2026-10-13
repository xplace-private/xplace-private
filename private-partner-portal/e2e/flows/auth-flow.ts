import type { Page } from '@playwright/test'

import { MOCK_CODE, type TestUser } from '../data/users'
import { HomePage } from '../pages/home-page'
import { SignInPage } from '../pages/sign-in-page'

export class AuthFlow {
  constructor(private readonly page: Page) {}

  /** Visits the root as an anonymous user, who is redirected to the sign-in page. */
  async openRoot(): Promise<SignInPage> {
    await this.page.goto('/')
    return new SignInPage(this.page).waitUntilLoaded()
  }

  /** First visit of the tab: sign in, set up the authenticator, set a permanent password. */
  async completeInitialSetup(user: TestUser): Promise<HomePage> {
    const signIn = await new SignInPage(this.page).open()
    const authenticator = await signIn.signIn(user)
    const setPassword = await authenticator.verify(MOCK_CODE)
    return setPassword.setPassword(user.password)
  }

  /** After a logout in the same tab: sign in and confirm with the 2FA code. */
  async signInReturning(user: TestUser): Promise<HomePage> {
    const signIn = await new SignInPage(this.page).open()
    const authenticator = await signIn.signInReturning(user)
    return authenticator.verifyReturning(MOCK_CODE)
  }
}
