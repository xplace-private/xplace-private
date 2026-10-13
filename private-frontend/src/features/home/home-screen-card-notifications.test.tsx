import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { toast } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { createReactDomTestContainer } from '../../shared/testing/react-dom-test-container'
import type { CardsGateway } from './api/cards-gateway'
import { CardActivationModal } from './components/card-activation-modal'
import { CardManagementPanel } from './components/card-management-panel'
import { CardPinModal } from './components/card-pin-modal'
import { HomeScreen } from './home-screen'
import type { HomeCard } from './model/card-collection'

vi.mock('sonner', () => ({ toast: vi.fn() }))
vi.mock('./components/card-management-panel', () => ({ CardManagementPanel: vi.fn(() => null) }))
vi.mock('./components/card-activation-modal', () => ({ CardActivationModal: vi.fn(() => null) }))
vi.mock('./components/card-pin-modal', () => ({ CardPinModal: vi.fn(() => null) }))
vi.mock('./components/your-cards', () => ({ YourCards: () => null }))
vi.mock('./components/getting-started-section', () => ({ GettingStartedSection: () => null }))

const physicalCard: HomeCard = {
  id: '17',
  backendId: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
  name: 'Physical card',
  kind: 'Physical',
  lastFour: '3559',
  status: 'Active',
  hasPin: false,
  details: null,
}

let root: Root | undefined

function mount(card: HomeCard, overrides: Partial<ComponentProps<typeof HomeScreen>> = {}) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {}, setTimeout, clearTimeout })
  const changeCardPin = vi.fn<CardsGateway['changePin']>().mockResolvedValue({ ok: true })
  const activatePhysicalCard = vi.fn<CardsGateway['activatePhysical']>()
    .mockResolvedValue({ ok: true, data: physicalCard })
  root = createRoot(createReactDomTestContainer())
  act(() => root?.render(
    <HomeScreen
      cards={[card]}
      transactions={[]}
      changeCardPin={changeCardPin}
      activatePhysicalCard={activatePhysicalCard}
      {...overrides}
    />,
  ))
  return { changeCardPin, activatePhysicalCard }
}

function management() {
  return vi.mocked(CardManagementPanel).mock.calls.at(-1)![0]
}

function pinModal() {
  return vi.mocked(CardPinModal).mock.calls.at(-1)![0]
}

function activationModal() {
  return vi.mocked(CardActivationModal).mock.calls.at(-1)![0]
}

function enterPin() {
  act(() => pinModal().onPinChange('4826'))
  act(() => pinModal().onSave())
  act(() => pinModal().onPinChange('4826'))
}

function enterActivation() {
  act(() => management().onActivate())
  act(() => {
    activationModal().onLastFourChange('3559')
    activationModal().onExpiryChange('09/29')
  })
}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

test.each([
  { kind: 'Physical', hasPin: false },
  { kind: 'Virtual', hasPin: false },
  { kind: 'Physical', hasPin: true },
  { kind: 'Virtual', hasPin: true },
] as const)('publishes only PIN updated for an active $kind card with hasPin=$hasPin', async (card) => {
  const { changeCardPin, activatePhysicalCard } = mount({ ...physicalCard, ...card })
  act(() => management().onPin())
  enterPin()
  expect(toast).not.toHaveBeenCalled()

  await act(async () => pinModal().onSave())

  expect(changeCardPin).toHaveBeenCalledExactlyOnceWith(physicalCard.backendId, '4826', expect.any(AbortSignal))
  expect(activatePhysicalCard).not.toHaveBeenCalled()
  expect(toast).toHaveBeenCalledExactlyOnceWith('PIN updated')
})

test('publishes PIN updated for a local physical card without a backend ID', async () => {
  vi.useFakeTimers()
  const { changeCardPin, activatePhysicalCard } = mount({ ...physicalCard, backendId: null })
  act(() => management().onPin())
  enterPin()
  act(() => pinModal().onSave())
  expect(toast).not.toHaveBeenCalled()

  await act(async () => vi.advanceTimersByTimeAsync(1000))

  expect(changeCardPin).not.toHaveBeenCalled()
  expect(activatePhysicalCard).not.toHaveBeenCalled()
  expect(toast).toHaveBeenCalledExactlyOnceWith('PIN updated')
  expect(management().card.hasPin).toBe(true)
})

test.each([
  { kind: 'Physical', hasPin: false },
  { kind: 'Virtual', hasPin: false },
  { kind: 'Physical', hasPin: true },
  { kind: 'Virtual', hasPin: true },
] as const)('rejects weak PIN on the first screen for $kind with hasPin=$hasPin and allows correction', async (card) => {
  const { changeCardPin, activatePhysicalCard } = mount({ ...physicalCard, ...card })
  act(() => management().onPin())
  act(() => pinModal().onPinChange('1111'))
  act(() => pinModal().onSave())

  expect(pinModal().state).toMatchObject({ status: 'entering', pin: '1111', error: 'repeated' })
  expect(changeCardPin).not.toHaveBeenCalled()
  expect(activatePhysicalCard).not.toHaveBeenCalled()
  expect(toast).not.toHaveBeenCalled()

  act(() => pinModal().onPinChange('4826'))
  expect(pinModal().state).toMatchObject({ status: 'entering', pin: '4826', error: null })
  act(() => pinModal().onSave())
  expect(pinModal().state.status).toBe('confirming')
  expect(changeCardPin).not.toHaveBeenCalled()
  act(() => pinModal().onPinChange('4826'))
  await act(async () => pinModal().onSave())

  expect(changeCardPin).toHaveBeenCalledExactlyOnceWith(physicalCard.backendId, '4826', expect.any(AbortSignal))
  expect(toast).toHaveBeenCalledExactlyOnceWith('PIN updated')
})

test('publishes Card activated after activation, opens PIN entry, then publishes PIN updated', async () => {
  let finishActivation!: (result: GatewayResult<HomeCard>) => void
  const activatePhysicalCard = vi.fn<CardsGateway['activatePhysical']>(() =>
    new Promise((resolve) => { finishActivation = resolve }),
  )
  const card: HomeCard = { ...physicalCard, status: 'Should be delivered' }
  const { changeCardPin } = mount(card, { activatePhysicalCard })
  enterActivation()
  act(() => activationModal().onSubmit())
  expect(activationModal().loading).toBe(true)
  expect(toast).not.toHaveBeenCalled()
  expect(CardPinModal).not.toHaveBeenCalled()

  await act(async () => finishActivation({ ok: true, data: physicalCard }))

  expect(activatePhysicalCard).toHaveBeenCalledExactlyOnceWith(card, '3559', '09/29', expect.any(AbortSignal))
  expect(toast).toHaveBeenCalledExactlyOnceWith('Card activated')
  expect(pinModal().state.status).toBe('entering')
  expect(changeCardPin).not.toHaveBeenCalled()
  enterPin()
  await act(async () => pinModal().onSave())
  expect(toast).toHaveBeenCalledTimes(2)
  expect(toast).toHaveBeenNthCalledWith(2, 'PIN updated')
})

test('does not publish success or open PIN entry after failed activation', async () => {
  const activatePhysicalCard = vi.fn<CardsGateway['activatePhysical']>().mockResolvedValue({
    ok: false, code: 'card-activation-failed', message: 'home.activation.errors.mismatch',
  })
  mount({ ...physicalCard, status: 'Should be delivered' }, { activatePhysicalCard })
  enterActivation()
  await act(async () => activationModal().onSubmit())

  expect(toast).not.toHaveBeenCalled()
  expect(CardPinModal).not.toHaveBeenCalled()
  expect(activationModal().error).toBe('home.activation.errors.mismatch')
})

test('does not publish success while PIN saving is pending or after it fails', async () => {
  let finishPin!: (result: GatewayResult) => void
  const changeCardPin = vi.fn<CardsGateway['changePin']>(() =>
    new Promise((resolve) => { finishPin = resolve }),
  )
  mount(physicalCard, { changeCardPin })
  act(() => management().onPin())
  enterPin()
  act(() => pinModal().onSave())
  expect(pinModal().state.status).toBe('saving')
  expect(toast).not.toHaveBeenCalled()

  await act(async () => finishPin({ ok: false, code: 'card-pin-failed', message: 'Unable to update PIN. Try again.' }))

  expect(toast).not.toHaveBeenCalled()
  expect(pinModal().state).toMatchObject({ status: 'confirming', error: { type: 'request' } })
})
