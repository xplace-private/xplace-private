# Router-Owned Session Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve current-user and applicant route eligibility before leaf-route commit while preserving one continuous cold-start loader and one continuous OTP code screen.

**Architecture:** Extract the existing singleton runtime so TanStack Router and React providers share one `QueryClient`, token store, and gateway set. A typed root `beforeLoad` calls a session-route resolver and redirects before leaf commit; TanStack Query remains the only current-user/applicant data owner. A narrow session generation rejects stale async decisions, and an injected OTP completion callback resolves applicant data before one final Router replacement without remounting the provider tree.

**Tech Stack:** React 19, strict TypeScript 6, Vite 8, TanStack Router 1.170, TanStack Query 5, Vitest 4, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-25-router-owned-session-gate-design.md`

## Global Constraints

- Add no runtime or development dependency and change no backend API contract.
- Keep one application-lifetime `QueryClient`; never construct it during render.
- Add no session-, token-, user-, or route-dependent React `key` to the root provider tree or pending surface.
- Router owns route eligibility; TanStack Query owns current-user and applicant server data.
- Token presence alone is not authenticated route access.
- An authenticated `401` clears the session; a non-401 current-user restoration failure shows `SessionRecovery`.
- An initial applicant failure reaches the route error boundary; cached applicant data survives a background refetch failure.
- Preserve the existing OTP draft, duplicate-submit protection, session recovery, Sumsub token lifecycle, verification polling, submitted latch, and two-second live approval presentation.
- Keep route-shaped pending UI and mobile behavior at 320 CSS px.
- Never edit `src/app/routeTree.gen.ts` manually.

---

## File Structure

### New files

- `src/app/session-generation.ts` — monotonic identity generation with no server-data duplication.
- `src/app/app-runtime.ts` — existing singleton Query client, API clients, gateways, stores, and cleanup wiring.
- `src/app/router-context.ts` — typed Router context and resolved route-access types.
- `src/app/route-session-resolver.ts` — cold-start/session route decision orchestration.
- `src/app/route-session-resolver.test.ts` — resolver matrix, errors, and stale-generation coverage.
- `src/app/session-route-pending.tsx` — target-shaped root pending UI.
- `src/app/session-route-pending.test.tsx` — pathname-to-pending-surface coverage.
- `src/app/router-session-gate.integration.test.tsx` — real memory-router mount/paint ordering and OTP continuity.

### Modified files

- `src/app/routes/__root.tsx` — typed context, async root `beforeLoad`, immediate pending component.
- `src/app/router.ts` — provide runtime context and reconcile non-OTP token removal/replacement.
- `src/app/root-route.tsx` — provider composition and runtime recovery/error rendering; remove effect redirects and duplicate cold-start gate.
- `src/features/auth/current-user-query.ts` — session-lifetime freshness after Router hydration.
- `src/features/verification/applicant-query.ts` — explicit-invalidation freshness after Router hydration.
- `src/features/verification/verification-flow-provider.tsx` — cached data, including `null`, is immediately ready.
- `src/features/verification/verification-flow-provider.test.tsx` — hydrated-cache and no-second-loading tests.
- `src/features/auth/auth-flow-provider.tsx` — injected post-OTP route handoff.
- `src/features/auth/auth-flow-provider.test.tsx` — post-OTP callback ordering and failure tests.
- `src/app/root-route.test.tsx` — remove effect-routing assumptions and preserve provider/verification behavior.
- `src/app/routes/home.tsx`, `onboarding.tsx`, `payment.tsx`, `transactions.tsx`, `verification.tsx`, `verification.sumsub.tsx` — remove redundant token-only guards after root coverage passes.
- `src/app/protected-route-guard.ts` and test — delete after root guard proves stronger behavior.

---

### Task 1: Extract Stable Runtime and Session Generation

**Files:**
- Create: `src/app/session-generation.ts`
- Create: `src/app/app-runtime.ts`
- Modify: `src/app/root-route.tsx`
- Test: `src/app/session-generation.test.ts`
- Test: existing app/runtime import tests affected by the extraction

**Interfaces:**
- Produces:

```ts
export interface SessionGeneration {
  read(): number
  advance(): number
  isCurrent(value: number): boolean
}

export function createSessionGeneration(): SessionGeneration

export interface AppRuntime {
  queryClient: QueryClient
  authSessionStore: AuthSessionStore
  verificationSessionStore: VerificationSessionStore
  sessionGeneration: SessionGeneration
  authGateway: AuthGateway
  currentUserGateway: CurrentUserGateway
  cardsGateway: CardsGateway
  transactionsGateway: TransactionsGateway
  occupationGateway: OccupationGateway
  onboardingGateway: OnboardingGateway
  applicantGateway: ApplicantGateway
  sumsubTokenGateway: SumsubTokenGateway
  clearSession(): void
}

export const appRuntime: AppRuntime

export function sameAuthTokens(
  left: AuthTokens | null,
  right: AuthTokens | null,
): boolean
```

- Consumes: all runtime construction currently at module scope in `src/app/root-route.tsx`.

- [ ] **Step 1: Write generation tests**

```ts
test('advances monotonically and rejects an earlier captured generation', () => {
  const generation = createSessionGeneration()
  const captured = generation.read()

  expect(generation.isCurrent(captured)).toBe(true)
  expect(generation.advance()).toBe(captured + 1)
  expect(generation.isCurrent(captured)).toBe(false)
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/app/session-generation.test.ts`

Expected: FAIL because `session-generation.ts` does not exist.

- [ ] **Step 3: Implement the minimal generation**

```ts
export function createSessionGeneration(): SessionGeneration {
  let value = 0
  return {
    read: () => value,
    advance: () => (value += 1),
    isCurrent: (captured) => captured === value,
  }
}
```

- [ ] **Step 4: Extract runtime composition without changing behavior**

Move the existing `QueryClient`, API base/client construction, gateways,
verification store, and cleanup query keys into `app-runtime.ts`. Wrap token
mutation so both `saveTokens` and `clear` advance the generation before
notifying subscribers. `saveTokens` must cancel/remove current-user and
applicant queries before adopting a different token pair; `clearSession` must
retain all current cleanup keys.

```ts
const authSessionStore: AuthSessionStore = {
  readTokens: browserAuthSessionStore.readTokens,
  subscribe: browserAuthSessionStore.subscribe,
  saveTokens(tokens) {
    const previous = browserAuthSessionStore.readTokens()
    if (!sameAuthTokens(previous, tokens)) {
      sessionGeneration.advance()
      clearIdentityQueries(queryClient)
    }
    browserAuthSessionStore.saveTokens(tokens)
  },
  clear() {
    sessionGeneration.advance()
    clearAllSessionQueries(queryClient)
    browserVerificationSessionStore.clear()
    browserAuthSessionStore.clear()
  },
}
```

`sameAuthTokens` compares both access and refresh strings and treats two nulls
as equal. Query cancellation/removal happens through named private helpers; no
generic shared abstraction is introduced.

- [ ] **Step 5: Point `RootRoute` at `appRuntime` and run focused tests**

Run: `pnpm test -- src/app/session-generation.test.ts src/app/root-route.test.tsx`

Expected: PASS with no provider remount behavior change.

- [ ] **Step 6: Commit the stable runtime extraction**

```bash
git add src/app/session-generation.ts src/app/session-generation.test.ts src/app/app-runtime.ts src/app/root-route.tsx
git commit -m "refactor: extract stable app session runtime"
```

---

### Task 2: Add the Pure Session-Route Resolver

**Files:**
- Create: `src/app/router-context.ts`
- Create: `src/app/route-session-resolver.ts`
- Create: `src/app/route-session-resolver.test.ts`
- Modify: `src/features/auth/current-user-query.ts`
- Modify: `src/features/verification/applicant-query.ts`

**Interfaces:**
- Consumes: `AppRuntime`, `resolveApplicantRoute`, existing current-user and applicant query options.
- Produces:

```ts
export type RouteAccess =
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser; applicant: Applicant | null }
  | { status: 'recovery-error'; message: string }

export type RouteSessionDecision =
  | { kind: 'allow'; access: RouteAccess }
  | { kind: 'redirect'; to: '/' | '/onboarding' | '/verification' | '/home' }

export interface AppRouterContext extends AppRuntime {}

export async function resolveRouteSession(
  runtime: AppRuntime,
  pathname: string,
): Promise<RouteSessionDecision>
```

- [ ] **Step 1: Write the resolver decision matrix**

Use deferred fake gateways and an isolated `QueryClient`. Cover:

```ts
test.each([
  ['/home', null, { kind: 'redirect', to: '/' }],
  ['/', null, { kind: 'allow', access: { status: 'anonymous' } }],
])('resolves anonymous access for %s', async (pathname, tokens, expected) => {
  const runtime = createResolverRuntime({ tokens })
  await expect(resolveRouteSession(runtime, pathname)).resolves.toEqual(expected)
})

test('routes an authenticated pending applicant away from the auth route', async () => {
  const runtime = createResolverRuntime({
    tokens: savedTokens,
    currentUser,
    applicant: pendingApplicant,
  })

  await expect(resolveRouteSession(runtime, '/')).resolves.toEqual({
    kind: 'redirect',
    to: '/verification',
  })
})
```

Also cover absent applicant, approved applicant, allowed durable routes,
current-user recovery failure, applicant failure, and a `401` that clears
tokens while current-user resolution rejects.

- [ ] **Step 2: Write the stale-generation regression**

```ts
test('does not publish applicant data resolved after the session generation changes', async () => {
  const applicant = deferred<Applicant | null>()
  const runtime = createResolverRuntime({ savedTokens, currentUser, applicant })
  const resolution = resolveRouteSession(runtime, '/')

  runtime.authSessionStore.clear()
  applicant.resolve(pendingApplicant)

  await expect(resolution).resolves.toEqual({
    kind: 'allow',
    access: { status: 'anonymous' },
  })
})
```

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm test -- src/app/route-session-resolver.test.ts`

Expected: FAIL because the resolver and context do not exist.

- [ ] **Step 4: Implement resolver with one restart loop**

The resolver captures generation and exact token strings, uses
`queryClient.fetchQuery` for current user and applicant, and checks freshness
after each await. If freshness changed, it restarts from current state.

```ts
for (;;) {
  const generation = runtime.sessionGeneration.read()
  const tokens = runtime.authSessionStore.readTokens()
  if (tokens === null) return anonymousDecision(pathname)

  try {
    const user = await runtime.queryClient.fetchQuery(
      currentUserQueryOptions(runtime.currentUserGateway),
    )
    if (!isSameSession(runtime, generation, tokens)) continue

    const applicant = await runtime.queryClient.fetchQuery(
      applicantQueryOptions(runtime.applicantGateway),
    )
    if (!isSameSession(runtime, generation, tokens)) continue

    return authenticatedDecision(pathname, user, applicant)
  } catch (error: unknown) {
    if (!isSameSession(runtime, generation, tokens)) continue
    if (runtime.authSessionStore.readTokens() === null) {
      return anonymousDecision(pathname)
    }
    if (error instanceof CurrentUserQueryError) {
      return recoveryDecision('Unable to restore session. Try again.')
    }
    throw error
  }
}
```

Use the existing safe recovery copy instead of rendering a gateway message.

- [ ] **Step 5: Make Router-hydrated query data session-fresh**

Add `staleTime: Infinity` to current-user and applicant query options. Current
user changes only with session replacement/clear; applicant changes are already
owned by explicit invalidation, onboarding refresh, and verification polling.
This prevents providers from immediately issuing a duplicate mount request
after `beforeLoad` hydrates the cache.

- [ ] **Step 6: Run resolver and query tests**

Run: `pnpm test -- src/app/route-session-resolver.test.ts src/features/auth/current-user-query.test.ts src/features/verification/applicant-query.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit resolver behavior**

```bash
git add src/app/router-context.ts src/app/route-session-resolver.ts src/app/route-session-resolver.test.ts src/features/auth/current-user-query.ts src/features/verification/applicant-query.ts
git commit -m "feat: resolve session access before routing"
```

---

### Task 3: Move Cold-Start Access Into Root Router Lifecycle

**Files:**
- Create: `src/app/session-route-pending.tsx`
- Create: `src/app/session-route-pending.test.tsx`
- Create: `src/app/router-session-gate.integration.test.tsx`
- Modify: `src/app/routes/__root.tsx`
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes: `AppRouterContext`, `resolveRouteSession`, `appRuntime`.
- Produces: root route context `{ routeAccess: RouteAccess }` and one immediate pending surface.

- [ ] **Step 1: Write pending-surface mapping tests**

```ts
test.each([
  ['/home', 'home-session-skeleton'],
  ['/transactions', 'transactions-session-skeleton'],
  ['/', 'Loading account'],
  ['/verification', 'Loading account'],
])('selects one pending surface for %s', (pathname, marker) => {
  mockRouterPathname(pathname)
  expect(renderToStaticMarkup(<SessionRoutePending />)).toContain(marker)
})
```

Use component mocks for the two feature skeletons; assert the account loader
keeps the existing `min-h-[441px]` geometry.

- [ ] **Step 2: Write a real memory-router cold-start test**

Construct a real TanStack route tree with the production resolver and a pending
component that counts mount/unmount effects. Delay current-user and applicant
separately.

```ts
expect(counters.pendingMounts).toBe(1)
expect(counters.authMounts).toBe(0)

currentUser.resolve(user)
await flushRouter()
expect(counters.pendingMounts).toBe(1)
expect(counters.pendingUnmounts).toBe(0)
expect(counters.authMounts).toBe(0)

applicant.resolve(pendingApplicant)
await waitForPath('/verification')
expect(counters.pendingMounts).toBe(1)
expect(counters.pendingUnmounts).toBe(1)
expect(counters.authMounts).toBe(0)
```

- [ ] **Step 3: Run both tests and verify failure**

Run: `pnpm test -- src/app/session-route-pending.test.tsx src/app/router-session-gate.integration.test.tsx`

Expected: FAIL because the pending component and root lifecycle are not wired.

- [ ] **Step 4: Implement root `beforeLoad` and pending route**

```ts
export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const decision = await resolveRouteSession(context, location.pathname)
    if (decision.kind === 'redirect') {
      throw redirect({ to: decision.to, replace: true })
    }
    return { routeAccess: decision.access }
  },
  component: RootRoute,
  pendingComponent: SessionRoutePending,
  pendingMs: 0,
  pendingMinMs: 0,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
})
```

Pass `context: appRuntime` to `createRouter`.

- [ ] **Step 5: Reconcile only token removal/replacement automatically**

At router module scope, capture the previous token pair and subscribe once.
Do not invalidate on `null -> tokens`, because that is OTP adoption.

```ts
let previousTokens = appRuntime.authSessionStore.readTokens()
appRuntime.authSessionStore.subscribe(() => {
  const nextTokens = appRuntime.authSessionStore.readTokens()
  if (previousTokens !== null && !sameAuthTokens(previousTokens, nextTokens)) {
    void router.invalidate()
  }
  previousTokens = nextTokens
})
```

- [ ] **Step 6: Run router lifecycle tests**

Run: `pnpm test -- src/app/router-session-gate.integration.test.tsx src/app/session-route-pending.test.tsx src/app/router.test.ts`

Expected: PASS; the pending mount count stays exactly one across both requests.

- [ ] **Step 7: Commit the root router gate**

```bash
git add src/app/session-route-pending.tsx src/app/session-route-pending.test.tsx src/app/router-session-gate.integration.test.tsx src/app/routes/__root.tsx src/app/router.ts
git commit -m "feat: gate routes before leaf commit"
```

---

### Task 4: Consume Hydrated Applicant Data Without a Second Loader

**Files:**
- Modify: `src/features/verification/verification-flow-provider.tsx`
- Modify: `src/features/verification/verification-flow-provider.test.tsx`
- Modify: `src/app/root-route.tsx`
- Modify: `src/app/root-route.test.tsx`

**Interfaces:**
- Consumes: Router-hydrated current-user/applicant cache from Tasks 2–3.
- Produces: provider status that is `success` whenever enabled query data is defined, including explicit `null`.

- [ ] **Step 1: Add hydrated-cache regressions**

Seed `APPLICANT_QUERY_KEY` before mounting the provider and assert:

```ts
expect(getVerification().applicantStatus).toBe('success')
expect(getVerification().applicant).toEqual(cachedApplicant)
expect(applicantGateway.get).not.toHaveBeenCalled()
```

Repeat with cached `null`. Add a render counter proving children do not observe
`loading` before `success`.

- [ ] **Step 2: Run the focused provider tests and verify failure**

Run: `pnpm test -- src/features/verification/verification-flow-provider.test.tsx`

Expected: FAIL because `applicantSessionReady` and `isFetchedAfterMount` force a second loading phase.

- [ ] **Step 3: Remove the mount-readiness latch**

Derive status only from enabled state and whether usable cache data exists:

```ts
if (!enabled) return 'disabled'
if (applicantQuery.data !== undefined) return 'success'
if (applicantQuery.isError) return 'error'
return 'loading'
```

Explicit `null` is data and therefore success. Preserve cached-data-on-
background-error behavior and the durable-progress submitted-latch effect.

- [ ] **Step 4: Simplify `RouteContent` without changing live feature behavior**

Remove applicant destination calculation, `redirectTo`, `liveVerificationUserId`,
and the effect-driven `history.replace`. Cold-start pending belongs to Router.
Keep only runtime rendering concerns:

```ts
if (session.status === 'recovery-error') {
  return <SessionRecovery ... />
}
if (session.status === 'authenticated' && applicantStatus === 'error' && applicantError) {
  throw applicantError
}
return <Outlet />
```

During OTP, the existing pending auth state keeps `CodeStep` busy; root provider
components remain mounted and unkeyed. VerificationScreen continues to own the
two-second live approval timer and its explicit navigation to `/home`.

- [ ] **Step 5: Update root tests and run both suites**

Run: `pnpm test -- src/features/verification/verification-flow-provider.test.tsx src/app/root-route.test.tsx`

Expected: PASS with no root effect redirects and no second applicant loader.

- [ ] **Step 6: Commit hydrated-provider continuity**

```bash
git add src/features/verification/verification-flow-provider.tsx src/features/verification/verification-flow-provider.test.tsx src/app/root-route.tsx src/app/root-route.test.tsx
git commit -m "fix: preserve session loading continuity"
```

---

### Task 5: Add Explicit OTP-to-Router Handoff

**Files:**
- Modify: `src/features/auth/auth-flow-provider.tsx`
- Modify: `src/features/auth/auth-flow-provider.test.tsx`
- Modify: `src/app/root-route.tsx`
- Modify: `src/app/router-session-gate.integration.test.tsx`

**Interfaces:**
- Produces in `AuthFlowProviderProps`:

```ts
onSessionReady(): Promise<void>
```

- Consumes: `resolveRouteSession(appRuntime, '/')` and Router navigation.

- [ ] **Step 1: Write provider ordering tests**

After successful OTP, assert exact ordering:

```ts
expect(events).toEqual([
  'tokens-saved',
  'current-user-resolved',
  'session-handoff-started',
  'session-handoff-finished',
])
expect(getAuth().state.submission).toBe('idle')
```

Use a deferred `onSessionReady` and assert `verifyCode()` plus the code-screen
submission remain pending until it resolves. On handoff rejection, assert OTP
is not submitted again and the method resolves `false`.

- [ ] **Step 2: Run provider tests and verify failure**

Run: `pnpm test -- src/features/auth/auth-flow-provider.test.tsx`

Expected: FAIL because `onSessionReady` is absent.

- [ ] **Step 3: Await the injected handoff after current-user fetch**

```ts
sessionStore.saveTokens(result.data)
try {
  await queryClient.fetchQuery(currentUserQueryOptions(currentUserGateway))
  await onSessionReady()
  dispatch({ type: 'submissionSucceeded' })
  return true
} catch {
  dispatch({ type: 'submissionSucceeded' })
  return false
}
```

Keep `pendingRef` true until the callback finishes.

- [ ] **Step 4: Implement app-owned final navigation**

Inside root composition, create a stable callback with `useCallback`:

```ts
const onSessionReady = useCallback(async () => {
  const decision = await resolveRouteSession(appRuntime, '/')
  if (decision.kind === 'redirect') {
    await router.navigate({ to: decision.to, replace: true })
    return
  }
  await router.invalidate()
}, [router])
```

The normal authenticated `/` decision is always a durable redirect. The
fallback invalidation covers recovery/anonymous state changes without feature
code importing Router.

- [ ] **Step 5: Add the full OTP continuity integration regression**

Count provider, code screen, root pending, and email screen mounts:

```ts
expect(counters.codeMounts).toBe(1)
expect(counters.rootPendingMounts).toBe(0)
expect(counters.emailMounts).toBe(0)

currentUser.resolve(user)
applicant.resolve(pendingApplicant)
await waitForPath('/verification')

expect(counters.codeUnmounts).toBe(1)
expect(counters.rootPendingMounts).toBe(0)
expect(counters.emailMounts).toBe(0)
expect(counters.providerMounts).toBe(1)
```

- [ ] **Step 6: Run OTP and root integration suites**

Run: `pnpm test -- src/features/auth/auth-flow-provider.test.tsx src/features/auth/components/auth-submit-loading.test.tsx src/app/router-session-gate.integration.test.tsx src/app/root-route.test.tsx`

Expected: PASS with one code-screen instance and no root pending during OTP.

- [ ] **Step 7: Commit explicit OTP handoff**

```bash
git add src/features/auth/auth-flow-provider.tsx src/features/auth/auth-flow-provider.test.tsx src/app/root-route.tsx src/app/router-session-gate.integration.test.tsx
git commit -m "fix: hand authenticated sessions to router atomically"
```

---

### Task 6: Remove Redundant Leaf Guards and Verify the Complete Flow

**Files:**
- Delete: `src/app/protected-route-guard.ts`
- Delete: `src/app/protected-route-guard.test.ts`
- Modify: `src/app/routes/home.tsx`
- Modify: `src/app/routes/onboarding.tsx`
- Modify: `src/app/routes/payment.tsx`
- Modify: `src/app/routes/transactions.tsx`
- Modify: `src/app/routes/verification.tsx`
- Modify: `src/app/routes/verification.sumsub.tsx`
- Modify: affected route option tests
- Verify: all changed source and tests

**Interfaces:**
- Consumes: root Router guard proven by Tasks 3 and 5.
- Produces: one route-access authority with no token-only leaf checks.

- [ ] **Step 1: Expand direct-link integration coverage before deletion**

Add a table-driven real-router test for `/home`, `/onboarding`, `/payment`,
`/transactions`, `/verification`, and `/verification/sumsub` with no tokens.
Each target component increments a mount counter; assert replacement to `/` and
zero protected mounts.

Also cover pending, absent, approved, and Sumsub-eligible applicants against
the existing route policy.

- [ ] **Step 2: Run integration tests before deletion**

Run: `pnpm test -- src/app/router-session-gate.integration.test.tsx`

Expected: PASS while redundant guards still exist.

- [ ] **Step 3: Remove leaf `beforeLoad` imports/options and guard files**

Each protected file route keeps only its component declaration, for example:

```ts
export const Route = createFileRoute('/home')({
  component: HomeRoute,
})
```

Do not manually edit the generated route tree.

- [ ] **Step 4: Run focused route and lifecycle tests**

Run: `pnpm test -- src/app/router-session-gate.integration.test.tsx src/app/routes/-index.test.tsx src/app/routes/-verification.test.tsx src/app/navigation.test.ts src/app/applicant-route-policy.test.ts`

Expected: PASS; root guard remains the sole eligibility authority.

- [ ] **Step 5: Run complete automated verification**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands pass. Report the exact test count and any warnings.

- [ ] **Step 6: Perform real-browser throttled validation**

At a 320 px mobile viewport, verify:

1. hard-load `/` with a stored session while delaying current-user and applicant;
2. one account loader animation remains continuous through both responses;
3. email auth never appears;
4. OTP keeps the same code screen and button loader through final routing;
5. logout and simulated authenticated `401` reconcile to `/` without protected/auth overlap;
6. browser console contains no relevant errors or warnings.

- [ ] **Step 7: Commit guard cleanup and final coverage**

```bash
git add src/app/protected-route-guard.ts src/app/protected-route-guard.test.ts src/app/routes/home.tsx src/app/routes/onboarding.tsx src/app/routes/payment.tsx src/app/routes/transactions.tsx src/app/routes/verification.tsx src/app/routes/verification.sumsub.tsx src/app/router-session-gate.integration.test.tsx
git commit -m "refactor: centralize session route access"
```

---

## Final Review Checklist

- [ ] No session-dependent `key` exists on the root provider or pending tree.
- [ ] Cold current-user plus applicant resolution produces exactly one pending mount and one pending unmount.
- [ ] Root-hydrated applicant data produces no provider-level loading render or duplicate GET.
- [ ] OTP produces one code-screen mount, no root pending mount, no email mount, and one final replacement.
- [ ] Token removal/replacement advances session generation and rejects stale async results.
- [ ] Recovery, applicant errors, cached background errors, onboarding, polling, Sumsub, and two-second live approval behavior remain covered.
- [ ] Root Router lifecycle is the only route-eligibility authority.
- [ ] Full tests, typecheck, lint, build, `git diff --check`, and mobile browser validation pass.
