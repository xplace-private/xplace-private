import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { ContinueVerificationView } from './continue-verification-view'
import {
  deriveVerificationViewState,
} from './model/applicant'
import { useDocumentVisibility } from './use-document-visibility'
import { useVerificationFlow } from './verification-flow-provider'
import { VerificationStatusView } from './verification-status-view'

interface VerificationScreenProps {
  onStartSdk(): void
  onCompleted(): void
  onSignOut(): void
}

const unexpectedFailureMessage = 'Something went wrong. Please try again.'

/** Composes the real applicant verification state for the parent route. */
export function VerificationScreen({
  onStartSdk,
  onCompleted,
  onSignOut,
}: VerificationScreenProps) {
  const {
    applicant,
    applicantError,
    applicantStatus,
    refetchApplicant,
    tokenStatus,
    prepareToken,
    submitted,
    consumeAttemptFailure,
  } = useVerificationFlow()
  const documentVisible = useDocumentVisibility()
  const state =
    applicant === null || applicant === undefined
      ? null
      : deriveVerificationViewState(applicant, submitted)
  const [attemptError, setAttemptError] = useState(false)
  const [preparingOnContinue, setPreparingOnContinue] = useState(false)
  const [hideCurrentTokenError, setHideCurrentTokenError] = useState(false)
  const attemptFailureChecked = useRef(false)
  const continueAttempt = useRef(0)
  const committedState = useRef(state)
  const completionCalled = useRef(false)
  const onCompletedRef = useRef(onCompleted)

  useLayoutEffect(() => {
    onCompletedRef.current = onCompleted
  }, [onCompleted])

  useLayoutEffect(() => {
    if (state !== 'completed') completionCalled.current = false
    committedState.current = state
    if (state !== 'continue') continueAttempt.current += 1

    return () => {
      committedState.current = null
    }
  }, [state])

  useEffect(() => {
    if (state !== 'continue' || attemptFailureChecked.current) return

    attemptFailureChecked.current = true
    if (consumeAttemptFailure()) {
      // Keep the consumed session latch visible on this committed screen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttemptError(true)
    }
  }, [consumeAttemptFailure, state])

  useEffect(() => {
    if (
      (state !== 'under-review' && state !== 'account-pending') ||
      !documentVisible
    ) {
      return
    }

    void refetchApplicant()
    const interval = globalThis.setInterval(() => {
      void refetchApplicant()
    }, 3_000)

    return () => globalThis.clearInterval(interval)
  }, [documentVisible, refetchApplicant, state])

  useEffect(() => {
    if (state !== 'completed' || completionCalled.current) return

    completionCalled.current = true
    onCompletedRef.current()
  }, [state])

  useEffect(
    () => () => {
      continueAttempt.current += 1
    },
    [],
  )

  const continueVerification = useCallback(() => {
    const attempt = continueAttempt.current + 1
    continueAttempt.current = attempt
    setAttemptError(false)
    setHideCurrentTokenError(true)
    setPreparingOnContinue(true)

    void prepareToken()
      .then((prepared) => {
        if (
          continueAttempt.current !== attempt ||
          committedState.current !== 'continue'
        ) {
          return
        }
        if (prepared) onStartSdk()
        else setAttemptError(true)
      })
      .catch(() => {
        if (
          continueAttempt.current === attempt &&
          committedState.current === 'continue'
        ) {
          setAttemptError(true)
        }
      })
      .finally(() => {
        if (
          continueAttempt.current === attempt &&
          committedState.current !== null
        ) {
          setPreparingOnContinue(false)
        }
      })
  }, [onStartSdk, prepareToken])

  if (applicantStatus === 'error' && applicantError !== null) {
    throw applicantError
  }
  if (state === null) return null

  if (state === 'completed') return null

  if (state === 'continue') {
    const hasError =
      attemptError || (tokenStatus === 'error' && !hideCurrentTokenError)

    return (
      <ContinueVerificationView
        pending={preparingOnContinue}
        error={hasError ? unexpectedFailureMessage : null}
        onContinue={continueVerification}
        onSignOut={onSignOut}
      />
    )
  }

  return <VerificationStatusView status={state} onSignOut={onSignOut} />
}
