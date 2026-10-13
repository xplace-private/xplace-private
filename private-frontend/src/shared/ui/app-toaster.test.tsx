import { expect, test } from 'vitest'

import { AppToaster } from './app-toaster'

test('lays out notifications as a bounded, shrinkable row', () => {
  const toaster = AppToaster()
  const toastOptions = toaster.props.toastOptions

  expect(toaster.props.style).toEqual({ width: 'fit-content' })
  expect(toastOptions.style.width).toBe('max-content')
  expect(toastOptions.style.maxWidth).toBe(
    'min(343px, calc(100% - 32px))',
  )
  expect(toastOptions.classNames.toast).toContain('flex')
  expect(toastOptions.classNames.toast).toContain('gap-3')
  expect(toastOptions.classNames.toast).toContain('px-5')
  expect(toastOptions.classNames.toast).toContain('py-3')
  expect(toastOptions.classNames.toast).toContain(
    '[&:has([data-icon])]:px-3',
  )
  expect(toastOptions.classNames.icon).toContain('shrink-0')
  expect(toastOptions.classNames.content).toContain('min-w-0')
  expect(toastOptions.classNames.title).toContain('whitespace-normal')
  expect(toastOptions.classNames.title).toContain('break-words')
})
