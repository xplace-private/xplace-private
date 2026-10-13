import { toast } from 'sonner'

import { appI18n } from './i18n/app-i18n'

interface ClipboardWriter {
  writeText: (value: string) => Promise<void>
}

type FallbackCopier = (value: string) => boolean

function copyWithSelection(value: string) {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.append(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

/** Copies text and announces success through the app-level toaster. */
export async function copyToClipboard(
  value: string,
  clipboard?: ClipboardWriter,
  fallbackCopy: FallbackCopier = copyWithSelection,
) {
  toast(appI18n.t('common.copied'))
  let copied = false

  if (clipboard) {
    try {
      await clipboard.writeText(value)
      copied = true
    } catch {
      // Older mobile browsers and embedded WebViews may reject the Clipboard API.
    }
  }

  if (!copied) {
    try {
      copied = fallbackCopy(value)
    } catch {
      copied = false
    }
  }

  return copied
}
