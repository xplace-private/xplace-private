import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import {
  mapUnexpectedPaymentPlansError,
  type PaymentPlansGateway,
} from './api/payment-plans-gateway'
import type { PaymentPlan, StartPaymentPlanInput } from './model/payment-plan'
import {
  createPaymentPlansState,
  paymentPlansReducer,
  type PaymentPlansState,
} from './model/payment-plans-state'

interface PaymentPlansValue {
  state: PaymentPlansState
  startPlan(input: StartPaymentPlanInput): Promise<GatewayResult<PaymentPlan>>
  settlePlan(planId: string): Promise<GatewayResult>
  resetSession(): void
}

interface PaymentPlansProviderProps {
  gateway: PaymentPlansGateway
  enabled?: boolean
  children: ReactNode
}

const PaymentPlansContext = createContext<PaymentPlansValue | null>(null)

interface CommittedPaymentPlansSession {
  token: object | null
  generation: number
  gateway: PaymentPlansGateway | null
  enabled: boolean
}

function requestPendingFailure(): Extract<GatewayResult, { ok: false }> {
  return {
    ok: false,
    code: 'request-pending',
    message: 'A payment plan update is already in progress.',
  }
}

function plansNotReadyFailure(): Extract<GatewayResult, { ok: false }> {
  return {
    ok: false,
    code: 'plans-not-ready',
    message: 'Payment plans are unavailable. Try again.',
  }
}

function planAlreadyActiveFailure(): Extract<GatewayResult, { ok: false }> {
  return {
    ok: false,
    code: 'plan-already-active',
    message: 'This transaction already has a payment plan.',
  }
}

function planNotActiveFailure(): Extract<GatewayResult, { ok: false }> {
  return {
    ok: false,
    code: 'plan-not-active',
    message: 'This payment plan is no longer active.',
  }
}

/** Owns the in-memory payment-plan collection and gateway orchestration. */
export function PaymentPlansProvider({
  gateway,
  enabled = true,
  children,
}: PaymentPlansProviderProps) {
  const [state, dispatch] = useReducer(
    paymentPlansReducer,
    undefined,
    createPaymentPlansState,
  )
  const configuration = useMemo(() => ({ gateway, enabled }), [enabled, gateway])
  const committedSessionRef = useRef<CommittedPaymentPlansSession>({
    token: null,
    generation: 0,
    gateway: null,
    enabled: false,
  })
  const generationCounterRef = useRef(0)
  const loadedGenerationRef = useRef<number | null>(null)
  const pendingRef = useRef(false)
  const revisionRef = useRef(0)
  const stateRef = useRef(state)

  useInsertionEffect(() => {
    const generation = generationCounterRef.current + 1
    generationCounterRef.current = generation
    committedSessionRef.current = {
      token: configuration,
      generation,
      gateway: configuration.gateway,
      enabled: configuration.enabled,
    }
    loadedGenerationRef.current = null
    pendingRef.current = false

    return () => {
      const invalidatedGeneration = generationCounterRef.current + 1
      generationCounterRef.current = invalidatedGeneration
      committedSessionRef.current = {
        token: null,
        generation: invalidatedGeneration,
        gateway: null,
        enabled: false,
      }
      loadedGenerationRef.current = null
      pendingRef.current = false
    }
  }, [configuration])

  useInsertionEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const session = committedSessionRef.current
    if (session.token !== configuration) return

    const generation = session.generation
    const revision = revisionRef.current
    loadedGenerationRef.current = null

    const isCurrentGeneration = () => {
      const currentSession = committedSessionRef.current
      return (
        revision === revisionRef.current &&
        currentSession.token === configuration &&
        currentSession.generation === generation
      )
    }

    async function loadPlans() {
      try {
        const result = await configuration.gateway.list()
        if (!isCurrentGeneration()) return

        if (result.ok) {
          loadedGenerationRef.current = generation
          dispatch({ type: 'plansLoaded', generation, plans: result.data })
        } else {
          loadedGenerationRef.current = null
          dispatch({ type: 'plansLoadFailed', generation, message: result.message })
        }
      } catch (error: unknown) {
        if (!isCurrentGeneration()) return

        const failure = mapUnexpectedPaymentPlansError(error)
        loadedGenerationRef.current = null
        dispatch({ type: 'plansLoadFailed', generation, message: failure.message })
      }
    }

    if (configuration.enabled) {
      dispatch({ type: 'plansLoading', generation })
      void loadPlans()
    } else {
      loadedGenerationRef.current = null
      dispatch({ type: 'sessionReset', generation })
    }

    return () => {
      if (loadedGenerationRef.current === generation) {
        loadedGenerationRef.current = null
      }
      revisionRef.current += 1
      pendingRef.current = false
    }
  }, [configuration])

  const callbackGeneration = state.generation
  const renderedReady = state.status === 'ready'

  const startPlan = useCallback(
    async (input: StartPaymentPlanInput): Promise<GatewayResult<PaymentPlan>> => {
      const session = committedSessionRef.current
      const currentState = stateRef.current
      if (
        session.token !== configuration ||
        callbackGeneration !== session.generation ||
        !renderedReady ||
        !session.enabled ||
        session.gateway === null ||
        currentState.status !== 'ready' ||
        currentState.generation !== session.generation ||
        loadedGenerationRef.current !== session.generation
      ) {
        return plansNotReadyFailure()
      }

      if (currentState.plans.some((plan) => plan.transactionId === input.transactionId)) {
        return planAlreadyActiveFailure()
      }

      if (pendingRef.current) {
        return requestPendingFailure()
      }

      const generation = session.generation
      const revision = revisionRef.current
      pendingRef.current = true
      const isCurrentSession = () => {
        const currentSession = committedSessionRef.current
        return (
          revision === revisionRef.current &&
          currentSession.token === configuration &&
          currentSession.generation === generation
        )
      }
      const canApplyMutation = () =>
        isCurrentSession() && loadedGenerationRef.current === generation

      try {
        const result = await session.gateway.start(input)
        if (canApplyMutation()) {
          if (result.ok) {
            const event = { type: 'planStarted' as const, generation, plan: result.data }
            stateRef.current = paymentPlansReducer(stateRef.current, event)
            dispatch(event)
          } else {
            dispatch({ type: 'mutationFailed', generation, message: result.message })
          }
        }
        return result
      } catch (error: unknown) {
        const failure = mapUnexpectedPaymentPlansError(error)
        if (canApplyMutation()) {
          dispatch({ type: 'mutationFailed', generation, message: failure.message })
        }
        return failure
      } finally {
        if (isCurrentSession()) {
          pendingRef.current = false
        }
      }
    },
    [callbackGeneration, configuration, renderedReady],
  )

  const settlePlan = useCallback(
    async (planId: string): Promise<GatewayResult> => {
      const session = committedSessionRef.current
      const currentState = stateRef.current
      if (
        session.token !== configuration ||
        callbackGeneration !== session.generation ||
        !renderedReady ||
        !session.enabled ||
        session.gateway === null ||
        currentState.status !== 'ready' ||
        currentState.generation !== session.generation ||
        loadedGenerationRef.current !== session.generation
      ) {
        return plansNotReadyFailure()
      }

      if (pendingRef.current) {
        return requestPendingFailure()
      }

      if (!currentState.plans.some((plan) => plan.id === planId)) {
        return planNotActiveFailure()
      }

      const generation = session.generation
      const revision = revisionRef.current
      pendingRef.current = true
      const isCurrentSession = () => {
        const currentSession = committedSessionRef.current
        return (
          revision === revisionRef.current &&
          currentSession.token === configuration &&
          currentSession.generation === generation
        )
      }
      const canApplyMutation = () =>
        isCurrentSession() && loadedGenerationRef.current === generation

      try {
        const result = await session.gateway.settle(planId)
        if (canApplyMutation()) {
          if (result.ok) {
            const event = { type: 'planSettled' as const, generation, planId }
            stateRef.current = paymentPlansReducer(stateRef.current, event)
            dispatch(event)
          } else {
            dispatch({ type: 'mutationFailed', generation, message: result.message })
          }
        }
        return result
      } catch (error: unknown) {
        const failure = mapUnexpectedPaymentPlansError(error)
        if (canApplyMutation()) {
          dispatch({ type: 'mutationFailed', generation, message: failure.message })
        }
        return failure
      } finally {
        if (isCurrentSession()) {
          pendingRef.current = false
        }
      }
    },
    [callbackGeneration, configuration, renderedReady],
  )

  const resetSession = useCallback(() => {
    const generation = generationCounterRef.current + 1
    generationCounterRef.current = generation
    committedSessionRef.current = {
      token: null,
      generation,
      gateway: null,
      enabled: false,
    }
    loadedGenerationRef.current = null
    revisionRef.current += 1
    pendingRef.current = false
    dispatch({ type: 'sessionReset', generation })
  }, [])

  const value = useMemo(
    () => ({ state, startPlan, settlePlan, resetSession }),
    [resetSession, settlePlan, startPlan, state],
  )

  return <PaymentPlansContext value={value}>{children}</PaymentPlansContext>
}

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export function usePaymentPlans(): PaymentPlansValue {
  const value = useContext(PaymentPlansContext)

  if (value === null) {
    throw new Error('usePaymentPlans must be used within PaymentPlansProvider')
  }

  return value
}
