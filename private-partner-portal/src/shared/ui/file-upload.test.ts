import { describe, expect, test } from 'vitest'

import { getFileUploadError } from './file-upload'

function file(name: string, type: string, size: number) {
  const value = new File([], name, { type })
  Object.defineProperty(value, 'size', { value: size })
  return value
}

describe('getFileUploadError', () => {
  test('accepts supported types through the 25 MiB limit', () => {
    expect(getFileUploadError(file('proof.pdf', 'application/pdf', 25 * 1024 * 1024))).toBeUndefined()
    expect(getFileUploadError(file('photo.PNG', 'image/png', 12))).toBeUndefined()
    expect(getFileUploadError(file('photo.jpeg', 'image/jpeg', 12))).toBeUndefined()
  })

  test('rejects oversized files and unsupported extension or MIME type', () => {
    expect(getFileUploadError(file('proof.pdf', 'application/pdf', 25 * 1024 * 1024 + 1))).toBe('tooLarge')
    expect(getFileUploadError(file('proof.txt', 'text/plain', 1))).toBe('invalidType')
    expect(getFileUploadError(file('proof.pdf', 'text/plain', 1))).toBe('invalidType')
  })
})
