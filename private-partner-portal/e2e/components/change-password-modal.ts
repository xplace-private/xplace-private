import type { Locator, Page } from '@playwright/test'

import { Modal } from './modal'

export class ChangePasswordModal extends Modal {
  readonly newPasswordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    super(page, 'Set up new password')
    this.newPasswordInput = this.dialog.getByLabel('New password', { exact: true })
    this.confirmPasswordInput = this.dialog.getByLabel('Confirm new password', { exact: true })
    this.submitButton = this.dialog.getByRole('button', { name: 'Change Password & Continue' })
  }

  async fill(newPassword: string, confirmation: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword)
    await this.confirmPasswordInput.fill(confirmation)
  }

  async submit(): Promise<void> {
    await this.submitButton.click()
  }
}
