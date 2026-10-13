import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { SectionHeader } from '../../../shared/ui/section-header'
import { TokenIcon } from '../../../shared/ui/token-icon'
import { CARD_STATUS_LABELS, canShowCardNumber, type HomeCard } from '../model/card-collection'

interface YourCardsProps {
  cards: readonly HomeCard[]
  error?: string | undefined
  selectedCardId: string | null
  onNew: () => void
  onSelect: (cardId: string) => void
  onRetry?: (() => void) | undefined
}

function CardRow({
  card,
  selected,
  onSelect,
}: {
  card: HomeCard
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useAppTranslation()

  return (
    <div className="flex min-w-0 items-center justify-between gap-4 py-[14px] first:pt-[15px]">
      <div className="flex min-w-0 flex-col gap-[3px] font-light">
        <span className="truncate text-[13px] leading-none">
          {card.name}
          {canShowCardNumber(card) ? (
            <> · {card.lastFour === null ? t('common.notAvailable') : `•••• ${card.lastFour}`}</>
          ) : null}
        </span>
        <span className="text-[11px] leading-none text-secondary">
          {t(
            card.kind === 'Virtual'
              ? 'home.cards.kind.virtual'
              : 'home.cards.kind.physical',
          )}{' '}
          ·{' '}
          {t(CARD_STATUS_LABELS[card.status])}
        </span>
      </div>
      {selected ? (
        <span className="shrink-0 border border-accent px-2.5 py-px text-[8px] leading-5 tracking-[1.6px] text-accent uppercase shadow-xs">
          {t('home.cards.showing')}
        </span>
      ) : (
        <Button
          className="shrink-0 text-secondary"
          variant="outline"
          size="compact"
          textStyle="body"
          onClick={onSelect}
        >
          {t('common.actions.show')}
        </Button>
      )}
    </div>
  )
}

/** User card collection and its initial-load recovery state. */
export function YourCards({
  cards,
  error,
  selectedCardId,
  onNew,
  onRetry,
  onSelect,
}: YourCardsProps) {
  const { t } = useAppTranslation()

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        action={
          cards.length < 3 ? (
            <Button
              className="shrink-0"
              variant="outline"
              withIcon
              size="compact"
              textStyle="body"
              onClick={onNew}
            >
              <TokenIcon className="size-3" src="/assets/home/plus.svg" />
              {t('home.cards.new')}
            </Button>
          ) : undefined
        }
      >
        {t('home.cards.title')}
      </SectionHeader>
      <p className="text-xs leading-[19.5px] font-light text-secondary">
        {t('home.cards.count', { count: cards.length })}
      </p>
      {error ? (
        <div className="flex min-w-0 items-center justify-between gap-4 border-l-2 border-accent bg-card px-4 py-3">
          <p className="min-w-0 text-xs leading-5 font-light text-accent">
            {t('home.cards.errors.load')}
          </p>
          {onRetry ? (
            <Button className="shrink-0" variant="outline" size="sm" onClick={onRetry}>
              {t('common.actions.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!error && cards.length === 0 ? (
        <p className="text-xs leading-5 font-light text-secondary">
          {t('home.cards.empty')}
        </p>
      ) : null}
      <div>
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            selected={card.id === selectedCardId}
            onSelect={() => onSelect(card.id)}
          />
        ))}
      </div>
    </section>
  )
}
