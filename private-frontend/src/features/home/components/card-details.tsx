import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import type { CardDetailsData } from '../model/card-collection'

export type { CardDetailsData } from '../model/card-collection'

interface CardDetailsProps {
  details: CardDetailsData
  remainingSeconds: number
  onCopy: (value: string) => void
}

interface DetailRowProps {
  label: string
  value: string
  copyValue?: string
  onCopy: (value: string) => void
  withBorder?: boolean
}

function DetailRow({ label, value, copyValue, onCopy, withBorder = true }: DetailRowProps) {
  const { t } = useAppTranslation()

  return (
    <div
      className={`flex min-w-0 items-center gap-2 py-[14px] ${withBorder ? 'border-b border-border' : ''}`}
    >
      <span className="min-w-0 flex-1 text-xs leading-normal font-light text-secondary">
        {label}
      </span>
      <span className="shrink-0 text-right text-[11px] leading-normal font-normal whitespace-nowrap text-foreground min-[360px]:text-[13px]">
        {value}
      </span>
      {copyValue ? (
        <Button
          className="shrink-0 text-secondary"
          variant="outline"
          size="compact"
          textStyle="body"
          onClick={() => onCopy(copyValue)}
        >
          {t('common.actions.copy')}
        </Button>
      ) : null}
    </div>
  )
}

/** Sensitive card values rendered from a replaceable data source. */
export function CardDetails({ details, remainingSeconds, onCopy }: CardDetailsProps) {
  const { t } = useAppTranslation()

  return (
    <section
      className="min-w-0 border border-border bg-card px-[18px] pt-[7px] pb-1.5"
      aria-label={t('home.cards.details')}
    >
      <DetailRow
        label={t('home.cards.number')}
        value={details.number}
        copyValue={details.number}
        onCopy={onCopy}
      />
      <DetailRow label={t('home.cards.expires')} value={details.expires} onCopy={onCopy} />
      <DetailRow
        label={t('home.cards.securityCode')}
        value={details.securityCode}
        copyValue={details.securityCode}
        onCopy={onCopy}
        withBorder={false}
      />
      <p className="py-[14px] text-[10px] leading-none font-normal tracking-[1.8px] text-secondary uppercase">
        {t('home.cards.hidesIn', { seconds: remainingSeconds })}
      </p>
    </section>
  )
}
