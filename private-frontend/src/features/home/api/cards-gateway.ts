import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { CardDetailsData, HomeCard } from '../model/card-collection'

export interface CardsGateway {
  list(signal?: AbortSignal): Promise<GatewayResult<readonly HomeCard[]>>
  activatePhysical(card: HomeCard, lastFour: string, expiry: string, signal?: AbortSignal): Promise<GatewayResult<HomeCard>>
  issueVirtual(
    name?: string,
    signal?: AbortSignal,
  ): Promise<GatewayResult<{ cardId: string }>>
  rename(
    cardId: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<GatewayResult<{ name: string }>>
  setFrozen(cardId: string, frozen: boolean, signal?: AbortSignal): Promise<GatewayResult>
  changePin(cardId: string, pin: string, signal?: AbortSignal): Promise<GatewayResult>
  getDetails(
    cardId: string,
    expiration: string,
    signal?: AbortSignal,
  ): Promise<GatewayResult<CardDetailsData>>
}
