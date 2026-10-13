import OtaClient from '@crowdin/ota-client'

/** Creates the public Crowdin OTA client only when a distribution is configured. */
export function createCrowdinOtaClient(distributionHash: string | null) {
  return distributionHash === null ? null : new OtaClient(distributionHash)
}
