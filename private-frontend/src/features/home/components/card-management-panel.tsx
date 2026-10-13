import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { TokenIcon } from '../../../shared/ui/token-icon'
import { CARD_STATUS_LABELS, isCardInDelivery, type HomeCard } from '../model/card-collection'

interface CardManagementPanelProps {
  card: HomeCard
  cardholderLastName?: string | undefined
  cardholderTitle?: 'Mr' | 'Ms' | undefined
  freezePending?: boolean
  onActivate: () => void
  onFreezeToggle: () => void
  onRename: () => void
  onPin: () => void
}

/** Selected-card status and the actions available for its current state. */
export function CardManagementPanel({
  card,
  cardholderLastName,
  cardholderTitle,
  freezePending = false,
  onActivate,
  onFreezeToggle,
  onRename,
  onPin,
}: CardManagementPanelProps) {
  const { t } = useAppTranslation()
  const frozen = card.status === 'Frozen'
  const inDelivery = isCardInDelivery(card)
  const notActivated = card.status === 'Not activated'
  const lastName = cardholderLastName?.trim()
  const cardholderName = lastName
    ? `${cardholderTitle === undefined ? '' : `${cardholderTitle} `}${lastName}`
    : null

  return (
    <section className="flex min-w-0 flex-col gap-4 border border-border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-2">
        <strong className="text-base leading-5 font-bold tracking-[-0.2px] text-foreground">{card.name}</strong>
        <span className="text-xs leading-4 font-light text-secondary">
          {cardholderName ? `${cardholderName} · ` : null}
          {t(CARD_STATUS_LABELS[card.status])}
        </span>
        {!frozen && !inDelivery && !notActivated ? (
          <span className="flex items-center gap-2 text-xs leading-4 font-light text-muted-foreground">
            <TokenIcon className="size-3.5 text-muted-foreground" src="/assets/home/wallet.svg" />
            {t('home.cards.readyWallet')}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 gap-2">
          {!notActivated ? (
            <Button
              className="flex-1"
              variant="outline"
              size="default"
              textStyle="body-light"
              disabled={freezePending}
              onClick={inDelivery ? onActivate : onFreezeToggle}
            >
              <span className="min-w-0 truncate">{t(
                inDelivery
                  ? 'home.cards.activate'
                  : frozen
                    ? 'home.cards.unfreeze'
                    : 'home.cards.freeze',
              )}</span>
            </Button>
          ) : null}
          <Button
            className="flex-1"
            variant="outline"
            size="default"
            textStyle="body-light"
            onClick={onRename}
          >
            <span className="min-w-0 truncate">{t('home.cards.rename')}</span>
          </Button>
        </div>
        {!frozen && !inDelivery && !notActivated ? (
          <Button
            className="flex-1"
            variant="outline"
            size="default"
            textStyle="body-light"
            onClick={onPin}
          >
            <span className="min-w-0 truncate">{t(card.hasPin ? 'home.cards.changePin' : 'home.cards.setPin')}</span>
          </Button>
        ) : null}
      </div>
    </section>
  )
}
