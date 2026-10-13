import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { SumsubWebSdkView } from './sumsub-web-sdk-view'

interface CapturedSdkProps {
  accessToken: string
  className: string
  expirationHandler(): Promise<string>
  config: {
    lang: string
    theme: string
  }
  options: {
    addViewportTag: boolean
    adaptIframeHeight: boolean
  }
  onMessage(type: string, payload: unknown): void
  onError?(error: unknown): void
}

let capturedSdkProps: CapturedSdkProps | null = null

vi.mock('@sumsub/websdk-react', () => ({
  default: (props: CapturedSdkProps) => {
    capturedSdkProps = props
    return null
  },
}))

function getCapturedSdkProps(): CapturedSdkProps {
  if (capturedSdkProps === null) {
    throw new Error('Expected the Sumsub SDK props to be captured')
  }

  return capturedSdkProps
}

describe('SumsubWebSdkView', () => {
  beforeEach(() => {
    capturedSdkProps = null
  })

  test('forwards its token, expiration callback, and fixed SDK setup', async () => {
    const onTokenExpired = vi.fn(async () => 'refreshed-token')

    const html = renderToStaticMarkup(
      <SumsubWebSdkView
        accessToken="access-token"
        onTokenExpired={onTokenExpired}
        onSubmitted={vi.fn()}
      />,
    )
    const props = getCapturedSdkProps()

    expect(html).toContain(
      'flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip',
    )
    expect(props.accessToken).toBe('access-token')
    expect(props.className).toContain('flex flex-1 flex-col')
    expect(props.className).toContain('[&>iframe]:grow')
    expect(props.expirationHandler).toBe(onTokenExpired)
    await expect(props.expirationHandler()).resolves.toBe('refreshed-token')
    expect(props.config).toEqual({ lang: 'en', theme: 'dark' })
    expect(props.options).toEqual({ addViewportTag: false, adaptIframeHeight: true })
  })

  test('emits submitted intent when the applicant is submitted', () => {
    const onSubmitted = vi.fn()

    renderToStaticMarkup(
      <SumsubWebSdkView
        accessToken="access-token"
        onTokenExpired={async () => 'refreshed-token'}
        onSubmitted={onSubmitted}
      />,
    )

    getCapturedSdkProps().onMessage('idCheck.onApplicantSubmitted', {})

    expect(onSubmitted).toHaveBeenCalledOnce()
  })

  test('emits submitted intent when the applicant is resubmitted', () => {
    const onSubmitted = vi.fn()

    renderToStaticMarkup(
      <SumsubWebSdkView
        accessToken="access-token"
        onTokenExpired={async () => 'refreshed-token'}
        onSubmitted={onSubmitted}
      />,
    )

    getCapturedSdkProps().onMessage('idCheck.onApplicantResubmitted', {})

    expect(onSubmitted).toHaveBeenCalledOnce()
  })

  test('does not emit an intent for unrelated SDK messages', () => {
    const onSubmitted = vi.fn()

    renderToStaticMarkup(
      <SumsubWebSdkView
        accessToken="access-token"
        onTokenExpired={async () => 'refreshed-token'}
        onSubmitted={onSubmitted}
      />,
    )

    getCapturedSdkProps().onMessage('idCheck.onStepCompleted', {})

    expect(onSubmitted).not.toHaveBeenCalled()
  })

  test('keeps provider errors inside the SDK instead of failing the host flow', () => {
    renderToStaticMarkup(
      <SumsubWebSdkView
        accessToken="access-token"
        onTokenExpired={async () => 'refreshed-token'}
        onSubmitted={vi.fn()}
      />,
    )

    expect(getCapturedSdkProps().onError).toBeUndefined()
  })

  test('lets Sumsub own its height on desktop while filling the mobile slot', () => {
    renderToStaticMarkup(
      <SumsubWebSdkView
        accessToken="access-token"
        onTokenExpired={async () => 'refreshed-token'}
        onSubmitted={vi.fn()}
      />,
    )

    expect(getCapturedSdkProps().className).toContain('md:flex-none')
    expect(getCapturedSdkProps().className).toContain(
      'md:[&>iframe]:grow-0',
    )
  })
})
