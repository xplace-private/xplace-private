import { describe, expect, it } from 'vitest'

import { mapUnexpectedAuthError } from './auth-gateway'

describe('mapUnexpectedAuthError', () => {
  it('maps unknown errors to a safe typed failure', () => {
    const result = mapUnexpectedAuthError(new Error('private upstream detail'))

    expect(result).toEqual({
      ok: false,
      code: 'unexpected-error',
      message: 'Unable to continue. Try again.',
    })
    expect(result.message).not.toContain('private upstream detail')
  })
})
