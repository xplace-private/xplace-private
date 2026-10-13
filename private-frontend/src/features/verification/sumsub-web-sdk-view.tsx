import SumsubWebSdk from '@sumsub/websdk-react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'

interface SumsubWebSdkViewProps {
  accessToken: string
  onTokenExpired(): Promise<string>
  onSubmitted(): void
}

export function SumsubWebSdkView({
  accessToken,
  onTokenExpired,
  onSubmitted,
}: SumsubWebSdkViewProps) {
  const { i18n } = useAppTranslation()
  const onMessage = (type: string) => {
    if (
      type === 'idCheck.onApplicantSubmitted' ||
      type === 'idCheck.onApplicantResubmitted'
    ) {
      onSubmitted()
    }
  }

  return (
    <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip">
      <SumsubWebSdk
        accessToken={accessToken}
        className="flex flex-1 flex-col md:flex-none [&>iframe]:grow md:[&>iframe]:grow-0"
        expirationHandler={onTokenExpired}
        config={{ lang: i18n.resolvedLanguage ?? 'en', theme: 'dark' }}
        options={{ addViewportTag: false, adaptIframeHeight: true }}
        onMessage={onMessage}
      />
    </div>
  )
}
