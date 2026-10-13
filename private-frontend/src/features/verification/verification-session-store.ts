export interface VerificationSessionStore {
  isSubmitted(): boolean
  markSubmitted(): void
  clearSubmitted(): void
  markAttemptFailed(): void
  consumeAttemptFailure(): boolean
  clear(): void
}

type VerificationSessionStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>

const submittedKey = 'xplace.verification.submitted'
const attemptErrorKey = 'xplace.verification.attempt-error'

export function createVerificationSessionStore(
  getStorage: () => VerificationSessionStorage,
): VerificationSessionStore {
  function withStorage<Result>(operation: (storage: VerificationSessionStorage) => Result) {
    try {
      return operation(getStorage())
    } catch {
      return undefined
    }
  }

  return {
    isSubmitted() {
      return withStorage((storage) => storage.getItem(submittedKey) === 'true') ?? false
    },
    markSubmitted() {
      withStorage((storage) => storage.setItem(submittedKey, 'true'))
    },
    clearSubmitted() {
      withStorage((storage) => storage.removeItem(submittedKey))
    },
    markAttemptFailed() {
      withStorage((storage) => storage.setItem(attemptErrorKey, 'true'))
    },
    consumeAttemptFailure() {
      return (
        withStorage((storage) => {
          const failed = storage.getItem(attemptErrorKey) === 'true'
          storage.removeItem(attemptErrorKey)
          return failed
        }) ?? false
      )
    },
    clear() {
      withStorage((storage) => {
        storage.removeItem(submittedKey)
        storage.removeItem(attemptErrorKey)
      })
    },
  }
}

export const browserVerificationSessionStore = createVerificationSessionStore(
  () => globalThis.sessionStorage,
)
