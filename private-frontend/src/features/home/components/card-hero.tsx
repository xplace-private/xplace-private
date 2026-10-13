import { useState } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { TokenIcon } from '../../../shared/ui/token-icon'
import { canShowCardNumber, type HomeCard } from '../model/card-collection'

interface CardHeroProps {
  card: HomeCard
  detailsLoading?: boolean
  detailsVisible: boolean
  onToggleDetails: () => void
}

/** Visual card surface with product-defined active and frozen states. */
export function CardHero({
  card,
  detailsLoading = false,
  detailsVisible,
  onToggleDetails,
}: CardHeroProps) {
  const { t } = useAppTranslation()
  const frozen = card.status === 'Frozen'
  const showNumber = canShowCardNumber(card)
  const imageSrc = frozen ? '/assets/home/frozen-card.png' : '/assets/home/active-card.png'
  const [loadedImageSrc, setLoadedImageSrc] = useState<string | null>(null)
  const imageLoaded = loadedImageSrc === imageSrc

  return (
    <section
      className={`relative flex aspect-[343/216] w-full min-w-0 items-end overflow-hidden rounded-2xl border-[0.25px] px-4 py-8 ${
        imageLoaded ? 'border-border' : 'border-transparent'
      }`}
    >
      <img
        className="absolute inset-0 size-full object-cover"
        src={imageSrc}
        alt={t('home.cards.cardAlt')}
        onLoad={({ currentTarget }) => {
          setLoadedImageSrc(currentTarget.getAttribute('src'))
        }}
      />
      {frozen ? <div className="absolute inset-0 bg-background/50" /> : null}
      {frozen ? (
        <span className="absolute inset-0 flex items-center justify-center text-[16.665px] leading-none font-light tracking-[5.94px] uppercase">
          {t('home.cards.status.frozen')}
        </span>
      ) : null}
      {showNumber ? (
        <div className="relative flex w-full items-center justify-between">
          <strong
            className={`text-base leading-none font-bold tracking-[-0.2px] ${
              frozen
                ? 'text-muted-foreground [text-shadow:0_0.3px_0_var(--background)]'
                : 'text-primary-foreground [text-shadow:0_0.3px_0_var(--card-number-shadow)]'
            }`}
          >
            {card.lastFour === null ? t('common.notAvailable') : `•••• ${card.lastFour}`}
          </strong>
          {(card.status === 'Active' || frozen) && (card.details || card.expiration) ? (
            <Button
              className={`rounded-full ${
                frozen
                  ? 'bg-muted-foreground hover:bg-muted-foreground'
                  : 'bg-primary-foreground hover:bg-primary-foreground'
              }`}
              variant={frozen ? 'secondary' : 'ghost'}
              size="icon-md"
              aria-label={t(
                detailsVisible ? 'home.cards.hideDetails' : 'home.cards.showDetails',
              )}
              aria-controls="card-details"
              aria-expanded={detailsVisible}
              disabled={detailsLoading}
              onClick={onToggleDetails}
            >
              <TokenIcon
                className="size-[18px] text-primary"
                src={detailsVisible ? '/assets/home/eye-off.svg' : '/assets/home/eye.svg'}
              />
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
