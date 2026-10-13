import { isApiRequestError, type ApiClient } from '../../../shared/api/api-client'
import { isTwoFactorRequirement } from './authenticator-gateway'

import type { CurrentUser, CurrentUserGateway } from './current-user-gateway'

const FAILURE = {
  ok: false as const,
  code: 'current-user-failed',
  message: 'Unable to restore session. Try again.',
}

export function createHttpCurrentUserGateway(
  apiClient: ApiClient,
): CurrentUserGateway {
  return {
    async get(signal) {
      try {
        const user = readCurrentUser(
          await apiClient.request('users/me/', {
            authenticated: true,
            signal,
          }),
        )

        return user === null ? FAILURE : { ok: true, data: user }
      } catch (error) {
        if (isApiRequestError(error) && error.status === 403) {
          let body: unknown = error.body
          if (typeof body === 'string') {
            try { body = JSON.parse(body) as unknown } catch { return FAILURE }
          }
          if (typeof body === 'object' && body !== null && 'error' in body && isTwoFactorRequirement(body.error)) {
            return { ok: false, code: body.error, message: 'Two-factor authentication required.' }
          }
        }
        return FAILURE
      }
    },
  }
}

function readCurrentUser(value: unknown): CurrentUser | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const { id, username, email, avatar } = record

  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 0) {
    return null
  }

  if (username !== null && typeof username !== 'string') {
    return null
  }

  if (
    email === undefined ||
    (email !== null && (typeof email !== 'string' || email.trim() === ''))
  ) {
    return null
  }

  if (avatar !== null && typeof avatar !== 'string') {
    return null
  }

  return { id, username, email, avatar }
}
