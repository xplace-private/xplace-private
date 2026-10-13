import { expect, test } from '../fixtures/test'

// localStorage key where the app persists the selected language.
const LANGUAGE_STORAGE_KEY = 'private-partner-portal.language'

test('a stored language sets html lang and translates the shared strings', async ({ page, signInPage }) => {
  await page.evaluate(({ key, language }) => window.localStorage.setItem(key, language), { key: LANGUAGE_STORAGE_KEY, language: 'fr' })
  await page.reload()

  await signInPage.signInButton.click()

  await expect.soft(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect.soft(page.getByText('Ce champ est obligatoire')).toHaveCount(2)
  // Product strings are not translated yet: this is the current behavior.
  await expect.soft(signInPage.heading).toBeVisible()
})

const TRANSLATED_REQUIRED_MESSAGES = [
  { language: 'es', message: 'Este campo es obligatorio' },
  { language: 'ru', message: 'Заполните поле' },
]

for (const { language, message } of TRANSLATED_REQUIRED_MESSAGES) {
  test(`stored ${language} translates the shared validation messages`, async ({ page, signInPage }) => {
    await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), { key: LANGUAGE_STORAGE_KEY, value: language })
    await page.reload()

    await signInPage.signInButton.click()

    await expect.soft(page.locator('html')).toHaveAttribute('lang', language)
    await expect.soft(page.getByText(message)).toHaveCount(2)
  })
}
