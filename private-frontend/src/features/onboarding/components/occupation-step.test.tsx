import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createOnboardingFlowState } from '../model/onboarding-flow'

const occupationStepTestState = vi.hoisted(() => ({ value: null as unknown }))

vi.mock('../onboarding-flow-provider', () => ({
  useOnboardingFlow: () => occupationStepTestState.value,
}))

import { OccupationStep } from './occupation-step'

function renderOccupationStep({
  occupations = [],
  occupationLoadStatus = 'success',
  selected = null,
  selectionError = false,
}: {
  occupations?: readonly { id: number; name: string }[]
  occupationLoadStatus?: 'loading' | 'success' | 'empty' | 'error'
  selected?: { id: number; name: string } | null
  selectionError?: boolean
} = {}) {
  occupationStepTestState.value = {
    state: {
      ...createOnboardingFlowState(),
      step: 2,
      occupation: selected,
      errors: selectionError ? { occupation: 'Select to continue' } : {},
    },
    occupations,
    occupationLoadStatus,
    occupationLoadError:
      occupationLoadStatus === 'error'
        ? 'Unable to load occupations. Try again.'
        : null,
    setOccupation: vi.fn(),
    setOccupationQuery: vi.fn(),
    continueStep: vi.fn(),
    retryOccupations: vi.fn(),
    back: vi.fn(),
  }

  return renderToStaticMarkup(<OccupationStep />)
}

beforeEach(() => {
  occupationStepTestState.value = null
})

test('renders five layout-stable rows and keeps Continue active while occupations load', () => {
  const html = renderOccupationStep({ occupationLoadStatus: 'loading' })

  expect(html).toContain('Loading occupations')
  expect(html.match(/animate-pulse/g)).toHaveLength(5)
  expect(html.match(/h-\[48px\]/g)).toHaveLength(5)
  expect(html).not.toContain('h-[55px]')
  expect(html).toContain('rounded-md')
  expect(html).not.toContain('rounded-none')
  expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue<\/button>/)
})

test('keeps Continue active and highlights loaded options after validation fails', () => {
  const html = renderOccupationStep({
    occupations: [{ id: 11, name: 'Accountant' }],
    selectionError: true,
  })

  expect(html).toContain('Select to continue')
  expect(html).toContain('aria-invalid="true"')
  expect(html).toContain('border-destructive')
  expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue<\/button>/)
})

test('renders loaded occupations and selects them by id', () => {
  const selected = { id: 12, name: 'Actuary' }
  const html = renderOccupationStep({
    occupations: [
      { id: 11, name: 'Accountant' },
      selected,
    ],
    selected,
  })

  expect(html.match(/role="radio"/g)).toHaveLength(2)
  expect(html).toContain('Accountant')
  expect(html).toContain('Actuary')
  expect(html).toContain('aria-checked="true"')
  expect(html).toContain('px-4 py-[11px]')
  expect(html).toContain('text-sm leading-6')
  expect(html).toContain('data-text-style="light"')
  expect(html).toContain('font-sans font-light')
  expect(html).toContain('<span class="size-4 shrink-0" aria-hidden="true">')
  expect(html).not.toContain('size-[15px]')
  expect(html).toContain('>Continue</span></button>')
  expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/)
})

test('sizes the occupation search from typography and padding', () => {
  const html = renderOccupationStep({ occupations: [{ id: 11, name: 'Accountant' }] })
  const input = html.match(/<input[^>]*id="occupation-search"[^>]*>/)?.[0]

  expect(input).toContain('font-sans')
  expect(input).toContain('py-[9.5px]')
  expect(input).toContain('text-lg leading-7')
  expect(input).not.toMatch(/\bh-\[/)
})

test('wraps long occupation labels to at most two lines', () => {
  const name =
    'Education Administrators, Elementary and Secondary School Managers'
  const html = renderOccupationStep({ occupations: [{ id: 11, name }] })

  expect(html).toContain(
    `<span class="min-w-0 flex-1"><span class="line-clamp-2 whitespace-normal">${name}</span></span>`,
  )
})

describe('non-success list states', () => {
  test('shows retry and keeps Continue active after a load error', () => {
    const html = renderOccupationStep({ occupationLoadStatus: 'error' })

    expect(html).toContain('Unable to load occupations. Try again.')
    expect(html).toContain('>Try again</button>')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue<\/button>/)
  })

  test('shows the empty state without inventing options', () => {
    const html = renderOccupationStep({ occupationLoadStatus: 'empty' })

    expect(html).toContain('No occupations found.')
    expect(html).not.toContain('role="radio"')
  })

  test('keeps Continue enabled for an existing selection during a new search', () => {
    const html = renderOccupationStep({
      occupationLoadStatus: 'loading',
      selected: { id: 12, name: 'Actuary' },
    })

    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue<\/button>/)
  })
})
