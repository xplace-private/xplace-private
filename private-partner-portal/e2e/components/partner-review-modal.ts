import type { Locator, Page } from '@playwright/test'

import { Modal } from './modal'

export interface UploadFile {
  name: string
  mimeType: string
  buffer: Buffer
}

export class PartnerReviewModal extends Modal {
  readonly investableInput: Locator
  readonly cashInput: Locator
  readonly fileInput: Locator
  readonly removeFileButton: Locator
  readonly confirmCheckbox: Locator
  readonly sendButton: Locator
  private readonly backButton: Locator
  readonly notice: Locator
  /** The drop target has no role and the file input is its direct child; it exists only while a file can be picked. */
  private readonly dropZone: Locator
  readonly uploadProgress: Locator

  constructor(page: Page, clientName: string) {
    super(page, clientName)
    this.investableInput = this.dialog.getByRole('textbox', { name: 'Investable Assets ($)' })
    this.cashInput = this.dialog.getByRole('textbox', { name: 'Cash Assets ($)' })
    this.fileInput = this.dialog.getByLabel('Upload AUM Confirmation')
    this.removeFileButton = this.dialog.getByRole('button', { name: 'Remove file' })
    this.confirmCheckbox = this.dialog.getByRole('checkbox', { name: 'I confirm the information above is accurate.' })
    this.sendButton = this.dialog.getByRole('button', { name: 'Send', exact: true })
    this.backButton = this.dialog.getByRole('button', { name: 'Back', exact: true })
    this.notice = this.dialog.getByRole('complementary')
    this.dropZone = this.fileInput.locator('..')
    this.uploadProgress = this.dialog.getByRole('progressbar', { name: 'Upload AUM Confirmation' })
  }

  async fillAmounts(investable: string, cash: string): Promise<void> {
    await this.investableInput.fill(investable)
    await this.cashInput.fill(cash)
  }

  async uploadFile(file: UploadFile): Promise<void> {
    await this.fileInput.setInputFiles(file)
  }

  /** Opens the native file chooser by clicking the upload zone, as a mouse user does, and picks the file in it. */
  async chooseFileViaDialog(file: UploadFile): Promise<void> {
    const chooser = this.page.waitForEvent('filechooser')
    await this.dropZone.click()
    await (await chooser).setFiles(file)
  }

  /** Drops the files on the drop zone with real drag events; keep the files small, they are copied through evaluate. */
  async dropFiles(files: readonly UploadFile[]): Promise<void> {
    const dataTransfer = await this.page.evaluateHandle(
      (items) => {
        const transfer = new DataTransfer()
        for (const item of items) transfer.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.mimeType }))
        return transfer
      },
      files.map((file) => ({ name: file.name, mimeType: file.mimeType, bytes: Array.from(file.buffer) })),
    )
    for (const type of ['dragenter', 'dragover', 'drop']) await this.dropZone.dispatchEvent(type, { dataTransfer })
  }

  async goBack(): Promise<void> {
    await this.backButton.click()
  }

  async confirm(): Promise<void> {
    await this.confirmCheckbox.click()
  }

  async send(): Promise<void> {
    await this.sendButton.click()
  }
}
