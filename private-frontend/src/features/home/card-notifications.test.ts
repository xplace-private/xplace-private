import { toast } from 'sonner'
import { describe, expect, test } from 'vitest'

import {
  showCardActivatedToast,
  showCardFreezedToast,
  showCardIssuedToast,
  showCardUnfreezedToast,
} from './card-notifications'

describe('card notifications', () => {
  test('publishes the card-issued notification after issuance succeeds', () => {
    showCardIssuedToast()

    const latestToast = toast.getToasts().at(-1)

    expect(latestToast).toMatchObject({ title: 'Card issued' })
  })

  test('publishes a notification when a card is frozen', () => {
    showCardFreezedToast()

    expect(toast.getToasts().at(-1)).toMatchObject({ title: 'Card frozen' })
  })

  test('publishes a notification when a card is unfrozen', () => {
    showCardUnfreezedToast()

    expect(toast.getToasts().at(-1)).toMatchObject({ title: 'Card unfrozen' })
  })

  test('publishes the activation notification', () => {
    showCardActivatedToast()

    expect(toast.getToasts().at(-1)).toMatchObject({ title: 'Card activated' })
  })
})
