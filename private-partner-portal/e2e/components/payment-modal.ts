import type { Locator, Page } from '@playwright/test'

import type { ClientStatusLabel } from '../data/clients'
import { Modal } from './modal'

export type PaymentMethod = 'USD' | 'EUR' | 'Crypto'

export class PaymentModal extends Modal {
  readonly backButton: Locator
  readonly qrCode: Locator
  readonly contactTeamLink: Locator
  readonly methodTabs: Locator
  /** The "send proof of payment" banner shown with the transfer details. */
  readonly proofNotice: Locator
  readonly emailSection: Locator
  readonly copyButtons: Locator

  constructor(page: Page, clientName: string) {
    super(page, clientName)
    this.backButton = this.dialog.getByRole('button', { name: 'Back', exact: true })
    this.qrCode = this.dialog.getByRole('img', { name: 'Deposit address QR code' })
    this.contactTeamLink = this.dialog.getByRole('link', { name: 'Contact Team' })
    this.methodTabs = this.dialog.getByRole('tablist', { name: 'Payment method' })
    this.proofNotice = this.notice('After paying your statement balance')
    this.emailSection = this.dialog.getByRole('region', { name: 'Email', exact: true })
    this.copyButtons = this.dialog.getByRole('button', { name: /^Copy / })
  }

  /** A banner by the beginning of its title, e.g. "Account suspended" or "Payment overdue". */
  notice(title: string): Locator {
    return this.dialog.getByRole('complementary').filter({ hasText: title })
  }

  /** The status badge by its label; it has no role, and notice titles ("Payment overdue") differ from it. */
  badge(status: ClientStatusLabel): Locator {
    return this.dialog.getByText(status, { exact: true })
  }

  methodTab(method: PaymentMethod): Locator {
    return this.dialog.getByRole('tab', { name: method, exact: true })
  }

  async selectMethod(method: PaymentMethod): Promise<void> {
    await this.methodTab(method).click()
  }

  async goBack(): Promise<void> {
    await this.backButton.click()
  }

  async copy(label: string): Promise<void> {
    await this.copyButton(label).click()
  }

  /** "Copy {label}" button, e.g. "IBAN", "Deposit address" or "Email". */
  copyButton(label: string): Locator {
    return this.dialog.getByRole('button', { name: `Copy ${label}`, exact: true })
  }

  /**
   * The row holding a label and its value, e.g. "Statement owed" or "IBAN": the label's parent.
   * Rows are plain elements without roles, so the label text is the only handle.
   */
  detailRow(label: string): Locator {
    return this.dialog.getByText(label, { exact: true }).locator('..')
  }

  /** Whether the banner comes before the "Statement owed" row in the DOM; a query, the spec asserts on it. */
  async noticePrecedesStatement(title: string): Promise<boolean> {
    const statement = await this.detailRow('Statement owed').elementHandle()
    try {
      return await this.notice(title).evaluate((notice, row) => Boolean(notice.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING), statement)
    } finally {
      await statement.dispose()
    }
  }
}
