import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

import { VerificationStatusView } from './verification-status-view'

describe('VerificationStatusView', () => {
  test.each(['under-review', 'account-pending', 'rejected'] as const)(
    'renders Sign out below the details for %s',
    (status) => {
      const html = renderToStaticMarkup(
        <VerificationStatusView status={status} onSignOut={vi.fn()} />,
      )

      expect(html).toMatch(
        /<\/dl><button[^>]*data-variant="outline"[^>]*data-size="lg"[^>]*class="[^"]*w-full[^"]*"[^>]*>Sign out<\/button>/,
      )
    },
  )

  test('renders the under-review application state', () => {
    const html = renderToStaticMarkup(<VerificationStatusView status="under-review" onSignOut={vi.fn()} />)

    expect(html).toContain('Checking your identity')
    expect(html).toContain(
      'This usually takes a few minutes. You can close this page — we message you on WhatsApp the moment it is done.',
    )
    expect(html).toContain('Under review')
    expect(html).not.toContain('Account pending')
    expect(html).toContain('font-sans text-sm leading-6 font-light')
    expect(html).toContain('text-[13px] leading-normal font-light')
    expect(html).toContain('py-2')
  })

  test('renders Account pending with verified identity and unchanged account details', () => {
    const html = renderToStaticMarkup(
      <VerificationStatusView status="account-pending" onSignOut={vi.fn()} />,
    )

    expect(html).toContain('Account pending')
    expect(html).toContain(
      'Your identity is verified. Your account opens once your adviser confirms the introduction and we set your limit.',
    )
    expect(html).toContain('Verified')
    expect(html).toContain('Up to USD 100,000')
    expect(html).toContain('Visa Platinum')
    expect(html).toContain('USD 250')
  })

  test('renders only the rejected identity and closed application rows', () => {
    const html = renderToStaticMarkup(<VerificationStatusView status="rejected" onSignOut={vi.fn()} />)

    expect(html).toContain('We could not open your account')
    expect(html).toContain(
      'We are not able to proceed at this time. Support can tell you what is needed and whether it can be resolved.',
    )
    expect(html).toMatch(/Identity<\/dt><dd[^>]*>Rejected<\/dd>/)
    expect(html).toMatch(/Application<\/dt><dd[^>]*>Closed<\/dd>/)
    expect(html).not.toContain('Limit')
    expect(html).not.toContain('Card')
    expect(html).not.toContain('Annual membership')
  })

  test('does not accept or render a raw rejection comment', () => {
    const rawRejectComment = 'The applicant gave the wrong identification details.'
    const html = renderToStaticMarkup(
      // @ts-expect-error Raw backend rejection comments are not a view prop.
      <VerificationStatusView status="rejected" onSignOut={vi.fn()} reject_comment={rawRejectComment} />,
    )

    expect(html).not.toContain(rawRejectComment)
  })
})
