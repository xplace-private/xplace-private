import { PARTNER_REVIEW_CLIENT, type KnownClient } from '../data/clients'
import { expect, test } from '../fixtures/test'

const AUM_PDF = { name: 'aum.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 aum confirmation') }
const AUM_PNG = { name: 'aum.png', mimeType: 'image/png', buffer: Buffer.from('png') }
const NOTES_TXT = { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') }

// The mock gateway reports 25, 50, 75 and 100 percent, one step every 150 ms; the last step completes the upload.
const UPLOAD_STEP_MS = 150
const UPLOAD_PROGRESS_STEPS = [25, 50, 75]

// Isolation relies on the mock gateway: a review mutates its in-memory state, which every
// document load starts afresh. With an HTTP gateway these tests need seeded or reset data.
const REVIEWED_CLIENT: KnownClient = { ...PARTNER_REVIEW_CLIENT, status: 'Limit review' }

test('a valid partner review moves the client to Limit review', { tag: '@both' }, async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  await expect.soft(review.dialog.getByText('Partner review', { exact: true })).toBeVisible()
  await expect.soft(review.dialog.getByText("Confirm the AUM and the client's identity.")).toBeVisible()

  await review.investableInput.pressSequentially('250000')
  await expect.soft(review.investableInput).toHaveValue('250,000')
  await review.cashInput.focus()
  await expect.soft(review.investableInput).toHaveValue('250,000.00')
  await review.cashInput.fill('0')
  await review.investableInput.focus()
  await expect.soft(review.cashInput).toHaveValue('0.00')
  await review.uploadFile(AUM_PDF)
  await expect.soft(review.dialog.getByText('Upload complete')).toBeVisible()
  await expect.soft(review.removeFileButton).toBeVisible()
  await review.confirm()
  await expect.soft(review.confirmCheckbox).toBeChecked()
  await review.send()

  await expect(review.dialog).toBeHidden()
  await expect.soft(homePage.clients.rowOf(REVIEWED_CLIENT)).toBeVisible()
  await expect.soft(homePage.clients.rowOf(PARTNER_REVIEW_CLIENT)).toHaveCount(0)
  await expect.soft(homePage.filters.button('Partner review')).toHaveText(/^Partner review\s*5$/)
  await expect.soft(homePage.filters.button('Limit review')).toHaveText(/^Limit review\s*6$/)
  await expect.soft(homePage.filters.button('All')).toHaveText(/^All\s*47$/)
})

test('sending an empty partner review shows every validation error', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.send()

  await expect.soft(review.dialog.getByText('Enter a valid amount of zero or more.')).toHaveCount(2)
  await expect.soft(review.investableInput).toHaveAttribute('aria-invalid', 'true')
  await expect.soft(review.cashInput).toHaveAttribute('aria-invalid', 'true')
  await expect.soft(review.dialog.getByText('Upload an AUM confirmation file.')).toBeVisible()
  await expect.soft(review.dialog.getByText('(FAILED)')).toBeVisible()
  await expect.soft(review.dialog.getByText('Confirm the information before sending.')).toBeVisible()
  await expect(review.dialog).toBeVisible()
})

test('unsupported files are rejected and an uploaded file can be removed', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.uploadFile(NOTES_TXT)

  await expect.soft(review.dialog.getByText('Choose a PDF, JPG or PNG file.')).toBeVisible()
  await expect.soft(review.dialog.getByText('(FAILED)')).toBeVisible()
  await expect.soft(review.dialog.getByText('Try again or choose another file')).toBeVisible()

  await review.uploadFile(AUM_PNG)
  await expect(review.dialog.getByText('Upload complete')).toBeVisible()

  await review.removeFileButton.click()

  await expect.soft(review.dialog.getByText('Drag & drop or click to upload')).toBeVisible()
  await expect.soft(review.dialog.getByText('Accepted formats: PDF, PNG, JPG up to 25MB')).toBeVisible()
  await expect.soft(review.removeFileButton).toHaveCount(0)
})

test('under the Partner review filter, a reviewed client leaves the list and focus moves to the filter', async ({ homePage }) => {
  await homePage.filterClientsBy('Partner review')
  await expect(homePage.clients.summary).toHaveText('Showing 6 of 6 clients')
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.fillAmounts('250000', '0')
  await review.uploadFile(AUM_PDF)
  await expect(review.dialog.getByText('Upload complete')).toBeVisible()
  await review.confirm()
  await review.send()

  await expect(review.dialog).toBeHidden()
  await expect.soft(homePage.clients.rowOf(PARTNER_REVIEW_CLIENT)).toHaveCount(0)
  await expect.soft(homePage.clients.summary).toHaveText('Showing 5 of 5 clients')
  await expect.soft(homePage.filters.button('Partner review')).toHaveText(/^Partner review\s*5$/)
  await expect.soft(homePage.filters.button('Limit review')).toHaveText(/^Limit review\s*6$/)
  await expect.soft(homePage.filters.button('Partner review')).toBeFocused()
})

test('Back, Close, Escape and outside click dismiss the review, return focus and discard the draft', { tag: '@both' }, async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  await expect(review.notice).toContainText('Complete the following to approve the client and move them to Limit Review.')
  await review.fillAmounts('250000', '0')
  await review.confirm()

  await review.goBack()

  await expect.soft(review.dialog).toBeHidden()
  await expect.soft(homePage.clients.actionsButtonOf(PARTNER_REVIEW_CLIENT)).toBeFocused()

  const afterBack = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  await expect.soft(afterBack.investableInput).toHaveValue('')
  await expect.soft(afterBack.cashInput).toHaveValue('')
  await expect.soft(afterBack.confirmCheckbox).not.toBeChecked()

  await afterBack.close()
  await expect.soft(afterBack.dialog).toBeHidden()
  await expect.soft(homePage.clients.actionsButtonOf(PARTNER_REVIEW_CLIENT)).toBeFocused()

  const afterClose = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  await afterClose.pressEscape()
  await expect.soft(afterClose.dialog).toBeHidden()
  await expect.soft(homePage.clients.actionsButtonOf(PARTNER_REVIEW_CLIENT)).toBeFocused()

  const afterEscape = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  await afterEscape.closeByClickingOutside()
  await expect.soft(afterEscape.dialog).toBeHidden()
  await expect.soft(homePage.clients.actionsButtonOf(PARTNER_REVIEW_CLIENT)).toBeFocused()
})

test('validation errors clear as each field is completed', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  const invalidAmount = review.dialog.getByText('Enter a valid amount of zero or more.')
  await review.send()
  await expect(invalidAmount).toHaveCount(2)

  await review.investableInput.fill('100')
  await expect.soft(review.investableInput).toHaveAttribute('aria-invalid', 'false')
  await expect.soft(invalidAmount).toHaveCount(1)

  await review.cashInput.fill('5')
  await expect.soft(invalidAmount).toHaveCount(0)

  await review.uploadFile(AUM_PDF)
  await expect.soft(review.dialog.getByText('Upload complete')).toBeVisible()
  await expect.soft(review.dialog.getByText('Upload an AUM confirmation file.')).toHaveCount(0)
  await expect.soft(review.dialog.getByText('(FAILED)')).toHaveCount(0)

  await review.confirm()
  await expect.soft(review.dialog.getByText('Confirm the information before sending.')).toHaveCount(0)
})

test('the confirmation checkbox toggles from the keyboard', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.confirmCheckbox.press('Space')
  await expect(review.confirmCheckbox).toBeChecked()

  await review.confirmCheckbox.press('Space')
  await expect(review.confirmCheckbox).not.toBeChecked()
})

test('clicking the upload zone opens the file chooser and the chosen file uploads', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.chooseFileViaDialog(AUM_PDF)

  await expect.soft(review.dialog.getByText('Upload complete')).toBeVisible()
  await expect.soft(review.dialog.getByText('aum.pdf')).toBeVisible()
})

test('upload progress advances in steps until the upload completes', async ({ homePage, page }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)
  // The clock fakes requestAnimationFrame, so it is installed only after the modal has opened.
  await page.clock.install({ time: new Date('2026-10-01T09:00:00') })
  await page.clock.pauseAt(new Date('2026-10-01T09:00:01'))

  await review.uploadFile(AUM_PDF)

  await expect(review.uploadProgress).toHaveAttribute('aria-valuenow', '0')
  await expect.soft(review.dialog.getByText('0%', { exact: true })).toBeVisible()

  for (const percent of UPLOAD_PROGRESS_STEPS) {
    await page.clock.runFor(UPLOAD_STEP_MS)

    await expect.soft(review.uploadProgress).toHaveAttribute('aria-valuenow', String(percent))
    await expect.soft(review.dialog.getByText(`${percent}%`, { exact: true })).toBeVisible()
  }

  await page.clock.runFor(UPLOAD_STEP_MS)

  await expect(review.dialog.getByText('Upload complete')).toBeVisible()
  await expect.soft(review.uploadProgress).toHaveCount(0)
})

test('an empty file fails to upload and a new file can be chosen', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.uploadFile({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) })

  await expect.soft(review.dialog.getByText('Unable to upload the file. Please try again.')).toBeVisible()
  await expect.soft(review.dialog.getByText('(FAILED)')).toBeVisible()
  await expect.soft(review.dialog.getByText('Try again or choose another file')).toBeVisible()

  await review.uploadFile(AUM_PDF)

  await expect(review.dialog.getByText('Upload complete')).toBeVisible()
})

test('a file over 25MB is rejected before upload', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.uploadFile({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(25 * 1024 * 1024 + 1) })

  await expect.soft(review.dialog.getByText('Upload failed. File exceeds 25MB limit.')).toBeVisible()
  await expect.soft(review.dialog.getByText('(FAILED)')).toBeVisible()
})

test('dropping several files is rejected and dropping one file uploads it', async ({ homePage }) => {
  const review = await homePage.clients.openPartnerReview(PARTNER_REVIEW_CLIENT)

  await review.dropFiles([AUM_PDF, AUM_PNG])

  await expect.soft(review.dialog.getByText('Choose one file at a time.')).toBeVisible()
  await expect.soft(review.dialog.getByText('(FAILED)')).toBeVisible()

  await review.dropFiles([AUM_PDF])

  await expect.soft(review.dialog.getByText('Upload complete')).toBeVisible()
  await expect.soft(review.dialog.getByText('aum.pdf')).toBeVisible()
  await expect.soft(review.dialog.getByText('0.0 MB • Upload complete')).toBeVisible()
})
