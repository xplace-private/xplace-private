import type { Locator, Page } from '@playwright/test'

/** Sonner notifications; the toaster renders an "aria-live" region, toasts are its list items. */
export class Toast {
  private readonly region: Locator
  /** The list of toasts; it is the focus target of the Alt+T hotkey. */
  readonly list: Locator

  constructor(page: Page) {
    this.region = page.getByRole('region', { name: /^Notifications/ })
    this.list = this.region.getByRole('list')
  }

  withText(text: string): Locator {
    return this.region.getByRole('listitem').filter({ hasText: text })
  }
}
