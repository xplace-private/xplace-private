import type { CardPinFlowState, PinValidationError } from './model/card-collection'

export function shouldKeepPinInputFocused(
  state: Exclude<CardPinFlowState, { status: 'closed' }>,
) {
  return (
    state.status === 'entering' ||
    (state.status === 'confirming' && state.confirmation !== state.pin)
  )
}

interface PinFocusState {
  status: Exclude<CardPinFlowState, { status: 'closed' }>['status']
  error: PinValidationError
}

export function shouldRestorePinInputFocus(previous: PinFocusState, current: PinFocusState) {
  return (
    current.status !== 'saving' &&
    (previous.status !== current.status || previous.error !== current.error)
  )
}
