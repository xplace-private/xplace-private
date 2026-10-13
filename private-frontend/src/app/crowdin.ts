import { appEnv } from '../shared/api/app-env'
import { appI18n } from '../shared/i18n/app-i18n'
import { createCrowdinOtaClient } from '../shared/i18n/crowdin-ota-client'
import { startCrowdinTranslationSync } from './crowdin-translations'

export const crowdinOtaClient = createCrowdinOtaClient(
  appEnv.crowdinDistributionHash,
)

startCrowdinTranslationSync(crowdinOtaClient, appI18n)
