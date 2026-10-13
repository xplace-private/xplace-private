import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test } from 'vitest'

import { createAppI18n } from '../../../shared/i18n/app-i18n'
import {
  shouldKeepPinInputFocused,
  shouldRestorePinInputFocus,
} from '../card-pin-interactions'
import { CardPinModal } from './card-pin-modal'

describe('CardPinModal', () => {
  test('renders the set-PIN first step with an actionable Save control', () => {
    const html = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin={false}
        state={{ status: 'entering', cardId: 'virtual-4417', pin: '', error: null }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('Set PIN')
    expect(html).toContain('Choose a four-digit PIN for Virtual card')
    expect(html).toContain('placeholder="0 0 0 0"')
    expect(html).not.toMatch(/maxlength=/i)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/)
    expect(html).toContain('>Cancel</button>')
  })

  test('renders confirmation feedback when the repeated PIN does not match', () => {
    const html = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin={true}
        state={{
          status: 'confirming',
          cardId: 'virtual-4417',
          pin: '1234',
          confirmation: '4321',
          error: 'mismatch',
        }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('Confirm PIN')
    expect(html).toContain('Enter the same four digits again')
    expect(html).toContain('PINs do not match')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('>Back</button>')
    expect(html).not.toContain('>Cancel</button>')
  })

  test('shows required and incomplete PIN messages', () => {
    const requiredHtml = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin={false}
        state={{ status: 'entering', cardId: 'virtual-4417', pin: '', error: 'required' }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )
    const incompleteHtml = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin={false}
        state={{ status: 'entering', cardId: 'virtual-4417', pin: '12', error: 'incomplete' }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(requiredHtml).toContain('This field is required')
    expect(incompleteHtml).toContain('Enter a four-digit PIN')
  })

  test.each([
    ['repeated', 'PIN cannot contain repeated numbers.', 'PIN-код не может состоять из одинаковых цифр.'],
    ['sequence', 'PIN cannot be a simple sequence.', 'Нельзя использовать простую последовательность цифр.'],
    ['consecutive', 'PIN cannot have more than 2 consecutive identical digits.', 'Нельзя использовать более двух одинаковых цифр подряд.'],
    ['weak', 'PIN pattern is too weak.', 'Слишком простой PIN-код.'],
    ['alternating', 'PIN cannot have an alternating pattern.', 'Нельзя использовать чередующийся шаблон цифр.'],
  ] as const)('renders the local %s error on the first PIN screen in the active language', (error, english, russian) => {
    for (const hasPin of [false, true]) {
      for (const language of ['en', 'ru'] as const) {
        const html = renderToStaticMarkup(
          <I18nextProvider i18n={createAppI18n(language)}>
            <CardPinModal
              cardName="Physical card"
              hasPin={hasPin}
              state={{ status: 'entering', cardId: '17', pin: '1111', error }}
              onPinChange={() => undefined}
              onBack={() => undefined}
              onCancel={() => undefined}
              onSave={() => undefined}
            />
          </I18nextProvider>,
        )

        expect(html).toContain(language === 'en' ? english : russian)
        expect(html).toContain('aria-invalid="true"')
        expect(html).toContain('aria-describedby="card-pin-error"')
        if (language === 'en') {
          expect(html).toContain(hasPin ? 'Change PIN' : 'Set PIN')
          expect(html).not.toContain('Confirm PIN')
        }
      }
    }
  })

  test('keeps the confirmation modal stable and blocks closing while saving', () => {
    const html = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin={false}
        state={{ status: 'saving', cardId: 'virtual-4417', pin: '1234' }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('Confirm PIN')
    expect(html).toMatch(/role="dialog"[^>]*data-close-disabled="true"/)
    expect(html).toMatch(/<input[^>]*disabled=""/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Back<\/button>/)
    expect(html).toContain('<svg')
    expect(html).toContain('value="1234"')
  })

  test('shows the backend PIN validation message after the update is rejected', () => {
    const html = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin
        state={{
          status: 'confirming',
          cardId: 'card-17',
          pin: '4826',
          confirmation: '4826',
          error: {
            type: 'request',
            message: 'PIN cannot contain repeated numbers',
          },
        }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('PIN cannot contain repeated numbers')
    expect(html).not.toContain('Unable to update PIN. Try again.')
  })

  test.each([
    ['PIN must be 4 digits', 'PIN-код должен состоять из 4 цифр.'],
    [
      'PIN cannot contain repeated numbers',
      'PIN-код не может состоять из одинаковых цифр.',
    ],
    [
      'PIN cannot be a simple sequence',
      'Нельзя использовать простую последовательность цифр.',
    ],
    [
      'Cannot have more than 2 consecutive identical digits',
      'Нельзя использовать более двух одинаковых цифр подряд.',
    ],
    ['PIN pattern is too weak', 'Слишком простой PIN-код.'],
    [
      'PIN cannot have alternating pattern',
      'Нельзя использовать чередующийся шаблон цифр.',
    ],
  ])('localizes the known backend PIN error %s', (message, expected) => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createAppI18n('ru')}>
        <CardPinModal
          cardName="Virtual card"
          hasPin
          state={{
            status: 'confirming',
            cardId: 'card-17',
            pin: '4826',
            confirmation: '4826',
            error: { type: 'request', message },
          }}
          onPinChange={() => undefined}
          onBack={() => undefined}
          onCancel={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>,
    )

    expect(html).toContain(expected)
  })

  test('keeps an unknown useful PIN error unchanged', () => {
    const html = renderToStaticMarkup(
      <CardPinModal
        cardName="Virtual card"
        hasPin
        state={{
          status: 'confirming',
          cardId: 'card-17',
          pin: '4826',
          confirmation: '4826',
          error: {
            type: 'request',
            message: 'This PIN was used recently.',
          },
        }}
        onPinChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('This PIN was used recently.')
  })

  test('keeps the keyboard open for step transition and mismatched confirmation only', () => {
    expect(
      shouldKeepPinInputFocused({
        status: 'entering',
        cardId: 'virtual-4417',
        pin: '1234',
        error: null,
      }),
    ).toBe(true)
    expect(
      shouldKeepPinInputFocused({
        status: 'confirming',
        cardId: 'virtual-4417',
        pin: '1234',
        confirmation: '4321',
        error: null,
      }),
    ).toBe(true)
    expect(
      shouldKeepPinInputFocused({
        status: 'confirming',
        cardId: 'virtual-4417',
        pin: '1234',
        confirmation: '1234',
        error: null,
      }),
    ).toBe(false)
  })

  test('skips initial focus but restores it after the PIN flow has started', () => {
    expect(
      shouldRestorePinInputFocus(
        { status: 'entering', error: null },
        { status: 'entering', error: null },
      ),
    ).toBe(false)
    expect(
      shouldRestorePinInputFocus(
        { status: 'entering', error: null },
        { status: 'entering', error: 'required' },
      ),
    ).toBe(true)
    expect(
      shouldRestorePinInputFocus(
        { status: 'entering', error: null },
        { status: 'confirming', error: null },
      ),
    ).toBe(true)
    expect(
      shouldRestorePinInputFocus(
        { status: 'confirming', error: null },
        { status: 'saving', error: null },
      ),
    ).toBe(false)
  })
})
