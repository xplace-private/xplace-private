import type { Page } from '@playwright/test'

import { MOCK_SESSION_KEY } from '../data/session'

const FLAG_KEY = '__e2e_session_storage_failure'

type FailureMode = 'read' | 'write'

/**
 * Makes the mock session key unreadable or unwritable, as in a browser with blocked storage.
 * The stub is installed in the current document and in every later one (reloads); the failure
 * mode lives in localStorage so it survives reloads, and only the session key is affected.
 */
export class SessionStorageFailure {
  private installed = false

  constructor(private readonly page: Page) {}

  async failReads(): Promise<void> {
    await this.activate('read')
  }

  async failWrites(): Promise<void> {
    await this.activate('write')
  }

  async restore(): Promise<void> {
    await this.page.evaluate((flagKey) => window.localStorage.removeItem(flagKey), FLAG_KEY)
  }

  private async activate(mode: FailureMode): Promise<void> {
    if (!this.installed) {
      const config = { flagKey: FLAG_KEY, sessionKey: MOCK_SESSION_KEY }
      await this.page.addInitScript(installStub, config)
      await this.page.evaluate(installStub, config)
      this.installed = true
    }
    await this.page.evaluate((flag) => window.localStorage.setItem(flag.key, flag.mode), { key: FLAG_KEY, mode })
  }
}

/** Runs in the page: idempotent, so the init script and the evaluate call can both apply it. */
function installStub(config: { flagKey: string; sessionKey: string }): void {
  if ('e2eStorageStub' in window) return
  Object.defineProperty(window, 'e2eStorageStub', { value: true })
  const originalGet = Storage.prototype.getItem
  const originalSet = Storage.prototype.setItem
  const failing = (mode: string): boolean => originalGet.call(window.localStorage, config.flagKey) === mode
  Storage.prototype.getItem = function (key: string): string | null {
    if (key === config.sessionKey && failing('read')) throw new DOMException('blocked', 'SecurityError')
    return originalGet.call(this, key)
  }
  Storage.prototype.setItem = function (key: string, value: string): void {
    if (key === config.sessionKey && failing('write')) throw new DOMException('blocked', 'SecurityError')
    originalSet.call(this, key, value)
  }
}
