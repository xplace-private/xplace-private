import type { AuthSessionStore } from '../features/auth/api/browser-auth-session-store'

interface RouteAccessInvalidator {
  invalidate(): Promise<unknown>
}

interface HotDisposeRegistrar {
  dispose(callback: () => void): void
}

export function registerSessionRouteObserverDisposal(
  hot: HotDisposeRegistrar | undefined,
  stopObserving: () => void,
) {
  hot?.dispose(stopObserving)
}

export function observeSessionRouteAccess(
  authSessionStore: AuthSessionStore,
  invalidator: RouteAccessInvalidator,
): () => void {
  let previousStatus = authSessionStore.readStatus()

  return authSessionStore.subscribe(() => {
    const nextStatus = authSessionStore.readStatus()
    if (previousStatus !== 'anonymous' && nextStatus === 'anonymous') {
      void invalidator.invalidate()
    }
    previousStatus = nextStatus
  })
}
