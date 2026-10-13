import { ActionTile } from '../../../shared/ui/action-tile'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
interface GettingStartedSectionProps {
  appleWalletAdded: boolean
  canOrderPhysical: boolean
  hasPhysicalCard: boolean
  onOrderPhysical: () => void
}

/** Account-level setup tasks that remain visible until each one is complete. */
export function GettingStartedSection({
  appleWalletAdded,
  canOrderPhysical,
  hasPhysicalCard,
  onOrderPhysical,
}: GettingStartedSectionProps) {
  const { t } = useAppTranslation()
  if (appleWalletAdded && hasPhysicalCard) return null

  return (
    <section className="flex min-w-0 flex-col gap-4 py-4">
      <p className="text-[10px] leading-none font-light tracking-[2.6px] text-secondary uppercase">
        {t('home.gettingStarted.title')}
      </p>
      <div className="flex min-w-0 flex-col gap-2">
        {!appleWalletAdded ? (
          <ActionTile
            iconSrc="/assets/home/card.svg"
            title={t('home.gettingStarted.walletTitle')}
            description={t('home.gettingStarted.walletDescription')}
            trailingIconSrc="/assets/home/arrow.svg"
          />
        ) : null}
        {!hasPhysicalCard && canOrderPhysical ? (
          <ActionTile
            iconSrc="/assets/home/card.svg"
            title={t('home.gettingStarted.physicalTitle')}
            description={t('home.gettingStarted.physicalDescription')}
            trailingIconSrc="/assets/home/arrow.svg"
            onClick={onOrderPhysical}
          />
        ) : null}
      </div>
    </section>
  )
}
