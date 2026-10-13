import { FlowHeading } from '../../shared/ui/flow-heading'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'

type VerificationStatusViewState =
  | 'under-review'
  | 'account-pending'
  | 'rejected'

interface VerificationStatusViewProps {
  status: VerificationStatusViewState
  onSignOut(): void
}

/** Pure visual representation of the current identity-verification status. */
export function VerificationStatusView({ status, onSignOut }: VerificationStatusViewProps) {
  const { t } = useAppTranslation()
  const applicationDetails = [
    { label: t('verification.status.limit'), value: t('verification.status.limitValue') },
    { label: t('verification.status.card'), value: t('verification.status.cardValue') },
    {
      label: t('verification.status.membership'),
      value: t('verification.status.membershipValue'),
    },
  ]
  const statusContent = {
    'under-review': {
      title: t('verification.status.underReview.title'),
      description: t('verification.status.underReview.description'),
      label: t('verification.status.underReview.label'),
      color: 'text-accent',
      details: applicationDetails,
    },
    'account-pending': {
      title: t('verification.status.verified.title'),
      description: t('verification.status.verified.description'),
      label: t('verification.status.verified.label'),
      color: 'text-positive',
      details: applicationDetails,
    },
    rejected: {
      title: t('verification.status.rejected.title'),
      description: t('verification.status.rejected.description'),
      label: t('verification.status.rejected.label'),
      color: 'text-destructive',
      details: [
        {
          label: t('verification.status.application'),
          value: t('verification.status.closed'),
        },
      ],
    },
  } satisfies Record<
    VerificationStatusViewState,
    {
      title: string
      description: string
      label: string
      color: string
      details: readonly { label: string; value: string }[]
    }
  >
  const content = statusContent[status]

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-10">
      <FlowHeading
        eyebrow={t('verification.status.eyebrow')}
        title={content.title}
        description={content.description}
      />

      <dl className="flex min-w-0 flex-col border border-border bg-card px-4 py-2">
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border py-2">
          <dt className="font-sans text-sm leading-6 font-light text-foreground">
            {t('verification.status.identity')}
          </dt>
          <dd className={`text-right text-[13px] leading-normal font-light ${content.color}`}>
            {content.label}
          </dd>
        </div>
        {content.details.map((detail, index) => (
          <div
            key={detail.label}
            className={`flex min-w-0 items-center justify-between gap-4 py-2 font-sans text-sm leading-6 font-light ${index < content.details.length - 1 ? 'border-b border-border' : ''}`}
          >
            <dt className="text-foreground">{detail.label}</dt>
            <dd className="text-right text-secondary">{detail.value}</dd>
          </div>
        ))}
      </dl>
      <Button
        className="w-full"
        variant="outline"
        size="lg"
        textStyle="regular"
        onClick={onSignOut}
      >
        {t('common.actions.signOut')}
      </Button>
    </section>
  )
}
