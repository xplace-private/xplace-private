import { toast } from 'sonner'

import { appI18n } from '../../shared/i18n/app-i18n'

export function showCardActivatedToast() {
  toast(appI18n.t('home.cards.notifications.activated'))
}

export function showCardFreezedToast() {
  toast(appI18n.t('home.cards.notifications.frozen'))
}

export function showCardIssuedToast() {
  toast(appI18n.t('home.cards.notifications.issued'))
}

export function showCardRenamedToast() {
  toast(appI18n.t('home.cards.notifications.renamed'))
}

export function showCardUnfreezedToast() {
  toast(appI18n.t('home.cards.notifications.unfrozen'))
}

export function showCardPinUpdatedToast() {
  toast(appI18n.t('home.cards.notifications.pinUpdated'))
}
