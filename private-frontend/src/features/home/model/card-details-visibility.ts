export interface CardDetailsVisibilityState {
  visible: boolean
  remainingSeconds: number
}

export type CardDetailsVisibilityEvent =
  | { type: 'toggle' }
  | { type: 'tick' }
  | { type: 'hide' }

export function createCardDetailsVisibilityState(): CardDetailsVisibilityState {
  return { visible: false, remainingSeconds: 20 }
}

export function cardDetailsVisibilityReducer(
  state: CardDetailsVisibilityState,
  event: CardDetailsVisibilityEvent,
): CardDetailsVisibilityState {
  if (event.type === 'hide') return createCardDetailsVisibilityState()

  if (event.type === 'toggle') {
    return state.visible
      ? createCardDetailsVisibilityState()
      : { visible: true, remainingSeconds: 20 }
  }

  if (!state.visible) return state
  if (state.remainingSeconds <= 1) return createCardDetailsVisibilityState()

  return { ...state, remainingSeconds: state.remainingSeconds - 1 }
}
