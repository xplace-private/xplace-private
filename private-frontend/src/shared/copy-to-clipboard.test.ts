import { toast } from 'sonner'
import { describe, expect, test } from 'vitest'

import { copyToClipboard } from './copy-to-clipboard'

describe('copyToClipboard', () => {
  test('copies the requested value and publishes the shared success toast', async () => {
    let copiedValue = ''
    const clipboard = {
      writeText: async (value: string) => {
        copiedValue = value
      },
    }

    const copied = await copyToClipboard('XP-4417-8825', clipboard)

    expect(copied).toBe(true)
    expect(copiedValue).toBe('XP-4417-8825')
    expect(toast.getToasts().at(-1)).toMatchObject({
      title: 'COPIED',
    })
    expect(toast.getToasts().at(-1)).not.toHaveProperty('position')
  })

  test('still announces the copy action when the browser rejects clipboard access', async () => {
    const toastCount = toast.getToasts().length
    const clipboard = {
      writeText: async () => {
        throw new Error('Clipboard unavailable')
      },
    }

    const copied = await copyToClipboard('XP-4417-8825', clipboard)

    expect(copied).toBe(false)
    expect(toast.getToasts()).toHaveLength(toastCount + 1)
    expect(toast.getToasts().at(-1)).toMatchObject({
      title: 'COPIED',
    })
    expect(toast.getToasts().at(-1)).not.toHaveProperty('position')
  })

  test('uses the fallback copier when the Clipboard API is unavailable', async () => {
    let fallbackValue = ''

    const copied = await copyToClipboard('crypto-wallet', undefined, (value) => {
      fallbackValue = value
      return true
    })

    expect(copied).toBe(true)
    expect(fallbackValue).toBe('crypto-wallet')
    expect(toast.getToasts().at(-1)).toMatchObject({
      title: 'COPIED',
    })
    expect(toast.getToasts().at(-1)).not.toHaveProperty('position')
  })

  test('announces immediately when a WebView leaves the Clipboard API pending', () => {
    const toastCount = toast.getToasts().length
    const clipboard = {
      writeText: () => new Promise<void>(() => undefined),
    }

    void copyToClipboard('crypto-wallet', clipboard)

    expect(toast.getToasts()).toHaveLength(toastCount + 1)
    expect(toast.getToasts().at(-1)).toMatchObject({
      title: 'COPIED',
    })
    expect(toast.getToasts().at(-1)).not.toHaveProperty('position')
  })

  test('publishes every copy action as a separate toast', () => {
    const clipboard = {
      writeText: () => new Promise<void>(() => undefined),
    }

    void copyToClipboard('first-value', clipboard)
    const firstToasts = toast.getToasts()
    const firstToastId = firstToasts.at(-1)?.id

    void copyToClipboard('second-value', clipboard)
    const secondToasts = toast.getToasts()

    expect(secondToasts).toHaveLength(firstToasts.length + 1)
    expect(secondToasts.at(-1)?.id).not.toBe(firstToastId)
  })
})
