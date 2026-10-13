import type { HomeGateway } from '../features/home/api/home-gateway'
import { createHttpHomeGateway } from '../features/home/api/http-home-gateway'

import type { AuthGateway } from '../features/auth/api/auth-gateway'
import { createHttpAuthGateway } from '../features/auth/api/http-auth-gateway'
import type { ProfileGateway } from '../features/profile/api/profile-gateway'
import { createHttpProfileGateway } from '../features/profile/api/http-profile-gateway'

import { setSentryUser } from './sentry'
import { createApiBaseUrls } from '../shared/api/api-base-urls'
import { appEnv } from '../shared/api/app-env'

export interface AppRuntime {
  authGateway: AuthGateway
  homeGateway: HomeGateway
  profileGateway: ProfileGateway
}

if (appEnv.apiBaseUrl === null) throw new Error('VITE_API_BASE_URL is required for the partner portal')

export const appRuntime: AppRuntime = {
  authGateway: createHttpAuthGateway({ baseUrl: createApiBaseUrls(appEnv.apiBaseUrl).portal, onUserChanged: setSentryUser }),
  homeGateway: createHttpHomeGateway({ baseUrl: createApiBaseUrls(appEnv.apiBaseUrl).portal }),
  profileGateway: createHttpProfileGateway({ baseUrl: createApiBaseUrls(appEnv.apiBaseUrl).portal }),
}
