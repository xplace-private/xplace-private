import type { PaymentPlan } from './payment-plan'

export interface PaymentPlansState {
  generation: number
  status: 'loading' | 'ready' | 'load-failed'
  plans: readonly PaymentPlan[]
  loadError: string | null
  mutationError: string | null
}

export type PaymentPlansEvent =
  | { type: 'plansLoading'; generation: number }
  | { type: 'plansLoaded'; generation: number; plans: readonly PaymentPlan[] }
  | { type: 'planStarted'; generation: number; plan: PaymentPlan }
  | { type: 'planSettled'; generation: number; planId: string }
  | { type: 'plansLoadFailed'; generation: number; message: string }
  | { type: 'mutationFailed'; generation: number; message: string }
  | { type: 'sessionReset'; generation: number }

export function createPaymentPlansState(generation = 0): PaymentPlansState {
  return {
    generation,
    status: 'loading',
    plans: [],
    loadError: null,
    mutationError: null,
  }
}

export function paymentPlansReducer(
  state: PaymentPlansState,
  event: PaymentPlansEvent,
): PaymentPlansState {
  if (event.generation < state.generation) {
    return state
  }

  if (
    event.type !== 'plansLoading' &&
    event.type !== 'sessionReset' &&
    event.generation !== state.generation
  ) {
    return state
  }

  switch (event.type) {
    case 'plansLoading':
      return createPaymentPlansState(event.generation)
    case 'plansLoaded':
      return {
        generation: event.generation,
        status: 'ready',
        plans: event.plans,
        loadError: null,
        mutationError: null,
      }
    case 'planStarted':
      return {
        generation: event.generation,
        status: 'ready',
        plans: [...state.plans, event.plan],
        loadError: null,
        mutationError: null,
      }
    case 'planSettled':
      return {
        generation: event.generation,
        status: 'ready',
        plans: state.plans.filter((plan) => plan.id !== event.planId),
        loadError: null,
        mutationError: null,
      }
    case 'plansLoadFailed':
      return {
        generation: event.generation,
        status: 'load-failed',
        plans: [],
        loadError: event.message,
        mutationError: null,
      }
    case 'mutationFailed':
      return { ...state, mutationError: event.message }
    case 'sessionReset':
      return createPaymentPlansState(event.generation)
  }
}
