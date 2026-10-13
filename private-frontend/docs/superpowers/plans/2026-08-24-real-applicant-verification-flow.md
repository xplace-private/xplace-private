# Real Applicant and Verification Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace onboarding and verification mocks with the existing applicant APIs, an internal Sumsub WebSDK route, and Rain-driven verification polling.

**Architecture:** A verification-owned provider exposes one validated applicant query, one in-memory Sumsub token query, and current-tab session flags to the app gate and both verification routes. Onboarding remains a separate feature, submits its accumulated draft once through the V2 endpoint, and lets the app layer invalidate applicant state before routing. `/verification` owns introduction/status UI and polling; `/verification/sumsub` owns the inline SDK and replaces itself after submit or resubmit.

**Tech Stack:** React 19, strict TypeScript, TanStack Query, TanStack Router file routes, Tailwind CSS v4, Vitest, pnpm 11, `@sumsub/websdk-react` 2.9.0.

**Spec:** `docs/superpowers/specs/2026-08-24-real-applicant-verification-flow-design.md`

## Global Constraints

- Make frontend-only changes in `/Users/yurymorozov/private-frontend`; do not modify `/Users/yurymorozov/backend`.
- Use existing authenticated endpoints exactly: `GET /api/v1/cards/applicant/detail/`, `POST /api/v2/cards/applicant/`, and `POST /api/v1/sumsub/access-token/`.
- Only a real applicant-detail HTTP 404 means no applicant; network, 408, 429, and 5xx failures use the existing `ApiClient` retry policy and never fall back to onboarding.
- Do not persist or submit agreements, residency, or the onboarding draft.
- Never put a Sumsub token in a URL, browser history, local storage, or session storage.
- Treat `rain_approved === true` as the only successful-completion signal. Sumsub `approved` with Rain not approved remains Under review.
- Treat Sumsub `rejected` and Rain `denied`, `locked`, or `canceled` as terminal rejection unless `rain_approved === true`.
- Poll applicant detail every 3,000 ms only on visible `/verification` Under review state; stop on unmount, approval, and rejection.
- Handle both `idCheck.onApplicantSubmitted` and `idCheck.onApplicantResubmitted` as submission completion.
- Match Figma file `DGxkBFVzZRrJub2k8Slyhg`, nodes `573:13792` and `293:43925`; do not reproduce browser chrome.
- Preserve `app -> features -> shared`; features must not import other features or `app`.
- Support 320 CSS pixels and mobile browsers/WebViews. Keep SDK containers `min-width: 0`, viewport-bounded, and free of fixed minimum widths.
- Do not expose raw backend, Sumsub, or Rain errors. Use `Something went wrong. Please try again.` for applicant submission, token, and SDK attempt failures.
- Never edit `src/app/routeTree.gen.ts` manually; regenerate it through the TanStack Router Vite plugin.

## File Structure

### Verification domain and I/O

- Create `src/features/verification/model/applicant.ts`: applicant enums, domain model, terminal-state helpers, and pure verification-state derivation.
- Create `src/features/verification/model/applicant.test.ts`: exhaustive state precedence.
- Create `src/features/verification/api/applicant-gateway.ts`: applicant gateway boundary.
- Create `src/features/verification/api/http-applicant-gateway.ts`: strict detail-response parser and 404 handling.
- Create `src/features/verification/api/http-applicant-gateway.test.ts`: endpoint, signal, parser, and failure tests.
- Create `src/features/verification/applicant-query.ts`: one query key, query options, and safe typed errors.
- Create `src/features/verification/applicant-query.test.ts`: query contract tests.
- Create `src/features/verification/api/sumsub-token-gateway.ts`: token model and gateway boundary.
- Create `src/features/verification/api/http-sumsub-token-gateway.ts`: strict token parser.
- Create `src/features/verification/api/http-sumsub-token-gateway.test.ts`: endpoint and invalid-response tests.
- Create `src/features/verification/sumsub-token-query.ts`: token query key and fresh-token loader.
- Create `src/features/verification/sumsub-token-query.test.ts`: safe failure and refresh behavior.
- Create `src/features/verification/verification-session-store.ts`: tab-scoped submitted and attempt-error flags.
- Create `src/features/verification/verification-session-store.test.ts`: storage isolation and clear behavior.
- Create `src/features/verification/verification-flow-provider.tsx`: applicant query, token query, session flags, and imperative refresh actions.
- Create `src/features/verification/verification-flow-provider.test.tsx`: provider lifecycle and in-memory token tests.

### Application routing and onboarding

- Create `src/app/applicant-route-policy.ts`: pure authenticated-route decision table.
- Create `src/app/applicant-route-policy.test.ts`: all initial and direct-navigation cases.
- Modify `src/app/root-route.tsx`: compose live gateways/provider and gate protected outlets.
- Modify `src/app/root-route.test.tsx`: applicant loading, redirects, logout cleanup, and no-flash tests.
- Create `src/features/onboarding/api/http-onboarding-gateway.ts`: one V2 applicant POST and purpose mapping.
- Create `src/features/onboarding/api/http-onboarding-gateway.test.ts`: exact request body and safe failures.
- Modify `src/features/onboarding/api/onboarding-gateway.ts`: replace step persistence with one complete-draft submission.
- Modify `src/features/onboarding/onboarding-flow-provider.tsx`: local steps 1–5 and final step submission.
- Modify `src/features/onboarding/onboarding-flow-provider.test.tsx`: no early POST, exact final input, failure, and retry.
- Modify `src/features/onboarding/complete-onboarding.ts` and its test: support an async app completion callback.
- Modify `src/app/routes/onboarding.tsx`: invalidate applicant data and replace the route after success.
- Delete `src/features/onboarding/api/mock-onboarding-gateway.ts` and `src/features/onboarding/api/mock-onboarding-gateway.test.ts` after application composition uses the HTTP gateway.

### Verification UI, SDK, and routes

- Create `src/features/verification/continue-verification-view.tsx` and its test: Figma node `573:13792`.
- Modify `src/features/verification/verification-status-view.tsx` and its test: add rejected state from node `293:44010` while retaining existing Under review and Verified layouts.
- Create `src/features/verification/sumsub-web-sdk-view.tsx` and its test: thin typed wrapper around `@sumsub/websdk-react`.
- Create `src/features/verification/sumsub-verification-screen.tsx` and its test: SDK token/error/submission orchestration.
- Create `src/features/verification/use-document-visibility.ts` and its test: active-tab signal.
- Rewrite `src/features/verification/verification-screen.tsx` and create `verification-screen.test.tsx`: state rendering, polling, latch, and redirect.
- Modify `src/app/navigation.ts` and its test: push SDK route, return by replacement after completion/error.
- Modify `src/app/routes/verification.tsx`: compose the real status screen.
- Create `src/app/routes/verification.sumsub.tsx`: compose the real inline SDK screen at `/verification/sumsub`.
- Modify `src/app/protected-route-guard.test.ts`: include the new protected SDK route.
- Delete `src/features/verification/api/verification-gateway.ts`, `mock-verification-gateway.ts`, and `mock-verification-gateway.test.ts` after live composition is complete.
- Modify `package.json` and `pnpm-lock.yaml`: add the approved SDK wrapper.
- Regenerate `src/app/routeTree.gen.ts` through `pnpm build` after adding the child route.

---

### Task 1: Applicant Domain, HTTP Gateway, and Query

**Files:**

- Create: `src/features/verification/model/applicant.ts`
- Create: `src/features/verification/model/applicant.test.ts`
- Create: `src/features/verification/api/applicant-gateway.ts`
- Create: `src/features/verification/api/http-applicant-gateway.ts`
- Create: `src/features/verification/api/http-applicant-gateway.test.ts`
- Create: `src/features/verification/applicant-query.ts`
- Create: `src/features/verification/applicant-query.test.ts`

**Interfaces:**

- Consumes: `ApiClient.request(path, options)` and `ApiRequestError` from `src/shared/api/api-client.ts`.
- Produces: `Applicant`, `VerificationViewState`, `deriveVerificationViewState(applicant, submitted)`, `ApplicantGateway.get(signal)`, `APPLICANT_QUERY_KEY`, and `applicantQueryOptions(gateway)`.

- [ ] **Step 1: Write the applicant state table tests**

Create cases that prove Rain approval has highest precedence and Sumsub approval alone is not success:

```ts
const baseApplicant: Applicant = {
  id: 41,
  sumsubId: 'sumsub-41',
  status: 'not_started',
  rainApproved: false,
  rainStatus: 'pending',
}

function applicant(fields: Partial<Applicant>): Applicant {
  return { ...baseApplicant, ...fields }
}

test.each([
  [{ status: 'not_started', rainApproved: false, rainStatus: 'pending' }, false, 'continue'],
  [{ status: 'temporary_rejected', rainApproved: false, rainStatus: 'pending' }, false, 'continue'],
  [{ status: 'not_started', rainApproved: false, rainStatus: 'pending' }, true, 'under-review'],
  [{ status: 'pending', rainApproved: false, rainStatus: 'pending' }, false, 'under-review'],
  [{ status: 'approved', rainApproved: false, rainStatus: 'manualReview' }, false, 'under-review'],
  [{ status: 'rejected', rainApproved: false, rainStatus: 'pending' }, false, 'rejected'],
  [{ status: 'approved', rainApproved: false, rainStatus: 'denied' }, false, 'rejected'],
  [{ status: 'rejected', rainApproved: true, rainStatus: 'approved' }, false, 'verified'],
] as const)('derives %s with submitted=%s as %s', (fields, submitted, expected) => {
  expect(deriveVerificationViewState(applicant(fields), submitted)).toBe(expected)
})
```

- [ ] **Step 2: Run the state tests and verify failure**

Run: `pnpm test src/features/verification/model/applicant.test.ts`

Expected: FAIL because `deriveVerificationViewState` and the applicant model do not exist.

- [ ] **Step 3: Implement the applicant domain**

Define exact unions and precedence:

```ts
export type SumsubApplicantStatus =
  | 'not_started'
  | 'pending'
  | 'approved'
  | 'temporary_rejected'
  | 'rejected'

export type RainApplicantStatus =
  | 'approved'
  | 'pending'
  | 'needsInformation'
  | 'needsVerification'
  | 'manualReview'
  | 'denied'
  | 'locked'
  | 'canceled'

export interface Applicant {
  id: number
  sumsubId: string | null
  status: SumsubApplicantStatus
  rainApproved: boolean
  rainStatus: RainApplicantStatus
}

export type VerificationViewState =
  | 'continue'
  | 'under-review'
  | 'verified'
  | 'rejected'

export function deriveVerificationViewState(
  applicant: Applicant,
  submitted: boolean,
): VerificationViewState {
  if (applicant.rainApproved) return 'verified'
  if (
    applicant.status === 'rejected' ||
    applicant.rainStatus === 'denied' ||
    applicant.rainStatus === 'locked' ||
    applicant.rainStatus === 'canceled'
  ) {
    return 'rejected'
  }
  if (submitted) return 'under-review'
  if (
    applicant.status === 'not_started' ||
    applicant.status === 'temporary_rejected'
  ) {
    return 'continue'
  }
  return 'under-review'
}
```

- [ ] **Step 4: Write HTTP gateway tests**

Cover a valid nested response, a 404 represented by `new ApiRequestError('http', 404, null, 'Request failed')`, a network rejection, each unsupported enum, a missing nested `applicant`, and signal forwarding. Assert the request exactly:

```ts
expect(request).toHaveBeenCalledWith('cards/applicant/detail/', {
  authenticated: true,
  signal,
})
```

The valid backend fixture must contain:

```ts
{
  applicant: {
    id: 41,
    sumsub_id: 'sumsub-41',
    status: 'pending',
    rain_approved: false,
    rain_status: 'manualReview',
  },
  cards: [],
  kyc_link: null,
}
```

- [ ] **Step 5: Run the HTTP gateway tests and verify failure**

Run: `pnpm test src/features/verification/api/http-applicant-gateway.test.ts`

Expected: FAIL because the applicant gateway files do not exist.

- [ ] **Step 6: Implement strict response parsing and 404 semantics**

Use this boundary:

```ts
export type ApplicantGatewayResult =
  | { ok: true; data: Applicant | null }
  | { ok: false; code: 'applicant-failed'; message: string }

export interface ApplicantGateway {
  get(signal?: AbortSignal): Promise<ApplicantGatewayResult>
}
```

In `createHttpApplicantGateway`, return `{ ok: true, data: null }` only when `isApiRequestError(error) && error.status === 404`. Return the safe `applicant-failed` result for malformed success bodies and every other rejection. Map snake_case fields to the domain model without parsing or exposing `cards`, `kyc_link`, or `reject_comment`.

- [ ] **Step 7: Write and implement applicant query tests**

Assert `APPLICANT_QUERY_KEY` is `['verification', 'applicant']`, Query retry is disabled because `ApiClient` already retries safe requests, focus refetch is disabled because verification owns visible-tab refresh, abort signals reach the gateway, 404 resolves to `null`, and a gateway failure throws `ApplicantQueryError` with only the safe code/message.

Implement:

```ts
export const APPLICANT_QUERY_KEY = ['verification', 'applicant'] as const

export function applicantQueryOptions(gateway: ApplicantGateway) {
  return queryOptions({
    queryKey: APPLICANT_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const result = await gateway.get(signal)
      if (result.ok) return result.data
      throw new ApplicantQueryError(result.code, result.message)
    },
    retry: false,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 8: Run Task 1 tests and commit**

Run:

```bash
pnpm test src/features/verification/model/applicant.test.ts src/features/verification/api/http-applicant-gateway.test.ts src/features/verification/applicant-query.test.ts
pnpm typecheck
git diff --check
```

Expected: all commands PASS.

Commit:

```bash
git add src/features/verification/model src/features/verification/api/applicant-gateway.ts src/features/verification/api/http-applicant-gateway.ts src/features/verification/api/http-applicant-gateway.test.ts src/features/verification/applicant-query.ts src/features/verification/applicant-query.test.ts
git commit -m "feat: add live applicant query"
```

### Task 2: Sumsub Token, Session Store, and Verification Provider

**Files:**

- Create: `src/features/verification/api/sumsub-token-gateway.ts`
- Create: `src/features/verification/api/http-sumsub-token-gateway.ts`
- Create: `src/features/verification/api/http-sumsub-token-gateway.test.ts`
- Create: `src/features/verification/sumsub-token-query.ts`
- Create: `src/features/verification/sumsub-token-query.test.ts`
- Create: `src/features/verification/verification-session-store.ts`
- Create: `src/features/verification/verification-session-store.test.ts`
- Create: `src/features/verification/verification-flow-provider.tsx`
- Create: `src/features/verification/verification-flow-provider.test.tsx`

**Interfaces:**

- Consumes: `ApplicantGateway` and `applicantQueryOptions` from Task 1.
- Produces: `SumsubTokenGateway`, `SUMSUB_TOKEN_QUERY_KEY`, `VerificationSessionStore`, `browserVerificationSessionStore`, `VerificationFlowProvider`, and `useVerificationFlow()`.

- [ ] **Step 1: Write token gateway tests**

Assert valid `{ token: '_act-token', userId: '41' }` data is returned, blank token/userId and non-object bodies fail safely, rejected requests fail safely, and the exact request is:

```ts
expect(request).toHaveBeenCalledWith('sumsub/access-token/', {
  authenticated: true,
  method: 'POST',
  retry: false,
  signal,
})
```

- [ ] **Step 2: Run token gateway tests and verify failure**

Run: `pnpm test src/features/verification/api/http-sumsub-token-gateway.test.ts`

Expected: FAIL because the token gateway does not exist.

- [ ] **Step 3: Implement the token gateway and query loader**

Define:

```ts
export interface SumsubToken {
  token: string
  userId: string
}

export interface SumsubTokenGateway {
  get(signal?: AbortSignal): Promise<GatewayResult<SumsubToken>>
}
```

Use `SUMSUB_TOKEN_QUERY_KEY = ['verification', 'sumsub-token'] as const`. Add `loadSumsubToken(gateway, signal)` that returns data or throws `SumsubTokenQueryError`. Configure the disabled provider query with `retry: false`, `refetchOnWindowFocus: false`, and `staleTime: Infinity`; token expiration is handled explicitly, not by time-based refetch.

- [ ] **Step 4: Write the current-tab store tests**

Use an in-memory `Storage` double and assert the exact behavior:

```ts
expect(store.isSubmitted()).toBe(false)
store.markSubmitted()
expect(store.isSubmitted()).toBe(true)
store.markAttemptFailed()
expect(store.consumeAttemptFailure()).toBe(true)
expect(store.consumeAttemptFailure()).toBe(false)
store.clear()
expect(storage.length).toBe(0)
```

Also assert unrelated storage keys survive `clear()`.

- [ ] **Step 5: Implement the session store**

Define the boundary:

```ts
export interface VerificationSessionStore {
  isSubmitted(): boolean
  markSubmitted(): void
  clearSubmitted(): void
  markAttemptFailed(): void
  consumeAttemptFailure(): boolean
  clear(): void
}

export function createVerificationSessionStore(
  getStorage: () => Pick<
    Storage,
    'getItem' | 'setItem' | 'removeItem'
  >,
): VerificationSessionStore
```

Use two namespaced keys, `xplace.verification.submitted` and `xplace.verification.attempt-error`. Store only the literal string `true`. Export the injectable factory for tests and `browserVerificationSessionStore = createVerificationSessionStore(() => globalThis.sessionStorage)` for application composition. The browser instance must resolve `globalThis.sessionStorage` when a method is called, not during module import, so server-rendered tests can import the module safely. `consumeAttemptFailure()` must remove only the attempt-error key.

- [ ] **Step 6: Write provider tests**

Mount the provider under a real `QueryClientProvider` and assert:

- applicant GET is disabled for an anonymous session and begins when `enabled` becomes true;
- applicant 404 is exposed as `applicant: null` with success status;
- `prepareToken()` deduplicates a successful cached token;
- `refreshToken()` always calls the token gateway again, updates the in-memory token, and returns only the token string;
- `clearToken()` removes token data;
- `markSubmitted()` updates React state and session storage before a route can unmount;
- durable applicant status `pending`, `approved`, or `rejected`, Rain approval, and terminal Rain rejection clear the submitted latch;
- `markAttemptFailed()` survives a sibling-route change and `consumeAttemptFailure()` clears it once.

- [ ] **Step 7: Implement the verification provider**

Use this provider boundary:

```ts
interface VerificationFlowProviderProps {
  applicantGateway: ApplicantGateway
  tokenGateway: SumsubTokenGateway
  sessionStore: VerificationSessionStore
  enabled: boolean
  children: ReactNode
}
```

Expose this stable context contract:

```ts
interface VerificationFlowValue {
  applicant: Applicant | null | undefined
  applicantStatus: 'disabled' | 'loading' | 'success' | 'error'
  applicantError: Error | null
  refetchApplicant(): Promise<void>
  invalidateApplicant(): Promise<void>
  token: SumsubToken | null
  tokenStatus: 'idle' | 'loading' | 'success' | 'error'
  prepareToken(): Promise<boolean>
  refreshToken(): Promise<string>
  clearToken(): void
  submitted: boolean
  markSubmitted(): void
  markAttemptFailed(): void
  consumeAttemptFailure(): boolean
}
```

Use `useQuery` for applicant data and a disabled `useQuery` for the token. Keep token data only in TanStack Query memory. `prepareToken()` must return `true` without refetching when token data already exists; otherwise it awaits the disabled query's `refetch()`. When `refreshToken()` calls `loadSumsubToken`, write the new value with `queryClient.setQueryData(SUMSUB_TOKEN_QUERY_KEY, token)`.

Add an effect that clears the submitted latch when the applicant supplies durable progress: Sumsub `pending`, `approved`, or `rejected`; `rainApproved === true`; or Rain `denied`, `locked`, or `canceled`. Do not clear it for stale `not_started` or `temporary_rejected`.

- [ ] **Step 8: Run Task 2 tests and commit**

Run:

```bash
pnpm test src/features/verification/api/http-sumsub-token-gateway.test.ts src/features/verification/sumsub-token-query.test.ts src/features/verification/verification-session-store.test.ts src/features/verification/verification-flow-provider.test.tsx
pnpm typecheck
git diff --check
```

Expected: all commands PASS.

Commit:

```bash
git add src/features/verification/api/sumsub-token-gateway.ts src/features/verification/api/http-sumsub-token-gateway.ts src/features/verification/api/http-sumsub-token-gateway.test.ts src/features/verification/sumsub-token-query.ts src/features/verification/sumsub-token-query.test.ts src/features/verification/verification-session-store.ts src/features/verification/verification-session-store.test.ts src/features/verification/verification-flow-provider.tsx src/features/verification/verification-flow-provider.test.tsx
git commit -m "feat: add verification flow provider"
```

### Task 3: Authenticated Applicant Gate

**Files:**

- Create: `src/app/applicant-route-policy.ts`
- Create: `src/app/applicant-route-policy.test.ts`
- Modify: `src/app/root-route.tsx`
- Modify: `src/app/root-route.test.tsx`

**Interfaces:**

- Consumes: `Applicant`, `deriveVerificationViewState`, `VerificationFlowProvider`, `useVerificationFlow`, `createHttpApplicantGateway`, `createHttpSumsubTokenGateway`, and `browserVerificationSessionStore` from Tasks 1–2.
- Produces: `resolveApplicantRoute(pathname, applicant)` and a root gate that never renders a stale protected destination.

- [ ] **Step 1: Write route-policy tests**

Cover the exact routing table:

```ts
const baseApplicant: Applicant = {
  id: 41,
  sumsubId: 'sumsub-41',
  status: 'not_started',
  rainApproved: false,
  rainStatus: 'pending',
}
const applicant = (fields: Partial<Applicant>) => ({ ...baseApplicant, ...fields })
const notStartedApplicant = applicant({})
const pendingApplicant = applicant({ status: 'pending' })
const approvedApplicant = applicant({ rainApproved: true, rainStatus: 'approved' })

expect(resolveApplicantRoute('/', null)).toBe('/onboarding')
expect(resolveApplicantRoute('/home', applicant({ sumsubId: null }))).toBe('/onboarding')
expect(resolveApplicantRoute('/', applicant({ rainApproved: true }))).toBe('/home')
expect(resolveApplicantRoute('/home', pendingApplicant)).toBe('/verification')
expect(resolveApplicantRoute('/verification', pendingApplicant)).toBeNull()
expect(resolveApplicantRoute('/verification/sumsub', notStartedApplicant)).toBeNull()
expect(resolveApplicantRoute('/verification/sumsub', pendingApplicant)).toBe('/verification')
expect(resolveApplicantRoute('/transactions', approvedApplicant)).toBeNull()
expect(resolveApplicantRoute('/payment', approvedApplicant)).toBeNull()
expect(resolveApplicantRoute('/onboarding', approvedApplicant)).toBe('/home')
```

`null` means the current path is allowed. A Sumsub terminal rejection or Rain terminal rejection allows `/verification` but not `/verification/sumsub`.

- [ ] **Step 2: Run route-policy tests and verify failure**

Run: `pnpm test src/app/applicant-route-policy.test.ts`

Expected: FAIL because the route policy does not exist.

- [ ] **Step 3: Implement the pure route policy**

Use path groups rather than a single destination comparison:

```ts
const homePaths = new Set(['/home', '/transactions', '/payment'])

export function resolveApplicantRoute(
  pathname: string,
  applicant: Applicant | null,
): '/onboarding' | '/verification' | '/home' | null {
  if (
    applicant === null ||
    applicant.sumsubId === null ||
    applicant.sumsubId.trim() === ''
  ) {
    return pathname === '/onboarding' ? null : '/onboarding'
  }
  if (applicant.rainApproved) {
    return homePaths.has(pathname) ? null : '/home'
  }
  const state = deriveVerificationViewState(applicant, false)
  if (pathname === '/verification') return null
  if (pathname === '/verification/sumsub' && state === 'continue') return null
  return '/verification'
}
```

Normalize `sumsubId === null` and blank strings as missing without changing any other applicant field.

- [ ] **Step 4: Extend root-route tests before changing composition**

Add applicant gateway control to the existing hoisted test state and test:

- anonymous sessions never request applicant detail;
- authenticated root with applicant 404 replaces to `/onboarding` without rendering the outlet;
- missing `sumsub_id` replaces to `/onboarding`;
- Rain pending replaces `/home` with `/verification`;
- Rain approved replaces `/` with `/home` and does not render Account pending;
- direct `/verification/sumsub` is allowed only for `continue` state;
- applicant loading withholds content and uses `HomeSessionSkeleton` only for `/home`;
- applicant failure does not replace to onboarding;
- logout removes applicant and token query data and clears only verification session keys.

- [ ] **Step 5: Run root tests and verify failure**

Run: `pnpm test src/app/root-route.test.tsx`

Expected: FAIL because root still routes every authenticated `/` session to onboarding.

- [ ] **Step 6: Compose the provider and gate protected content**

In `root-route.tsx`, create live applicant and token gateways from `v1Client`. Add an authenticated-provider component inside `AuthFlowProvider` so it can pass `enabled={session.status === 'authenticated'}` to `VerificationFlowProvider`. Move the old hard-coded authenticated `/` redirect into the applicant route policy.

The route content order must be:

```ts
if (session.status === 'checking') return sessionLoadingContent
if (session.status === 'recovery-error') return recoveryContent
if (session.status === 'authenticated' && applicantStatus === 'loading') {
  return pathname === '/home' ? <HomeSessionSkeleton /> : null
}
if (
  session.status === 'authenticated' &&
  applicantStatus === 'error' &&
  applicantError !== null
) {
  throw applicantError
}
if (redirectTo !== null) return null
return <Outlet />
```

Preserve the existing OTP-completion exception at `/`, anonymous redirects, Cards/Transactions/PaymentPlans provider behavior, and document gesture cleanup.

- [ ] **Step 7: Clear verification state on unauthorized session cleanup**

Cancel and remove `APPLICANT_QUERY_KEY` and `SUMSUB_TOKEN_QUERY_KEY` beside the existing current-user/cards/transactions cleanup. Call `browserVerificationSessionStore.clear()` after clearing auth tokens. Do not clear unrelated session storage.

- [ ] **Step 8: Run Task 3 tests and commit**

Run:

```bash
pnpm test src/app/applicant-route-policy.test.ts src/app/root-route.test.tsx
pnpm typecheck
git diff --check
```

Expected: all commands PASS.

Commit:

```bash
git add src/app/applicant-route-policy.ts src/app/applicant-route-policy.test.ts src/app/root-route.tsx src/app/root-route.test.tsx
git commit -m "feat: gate authenticated routes by applicant"
```

### Task 4: Real Final Onboarding Submission

**Files:**

- Create: `src/features/onboarding/api/http-onboarding-gateway.ts`
- Create: `src/features/onboarding/api/http-onboarding-gateway.test.ts`
- Modify: `src/features/onboarding/api/onboarding-gateway.ts`
- Modify: `src/features/onboarding/onboarding-flow-provider.tsx`
- Modify: `src/features/onboarding/onboarding-flow-provider.test.tsx`
- Modify: `src/features/onboarding/complete-onboarding.ts`
- Modify: `src/features/onboarding/complete-onboarding.test.ts`
- Modify: `src/app/routes/onboarding.tsx`
- Modify: `src/app/root-route.tsx`
- Delete: `src/features/onboarding/api/mock-onboarding-gateway.ts`
- Delete: `src/features/onboarding/api/mock-onboarding-gateway.test.ts`

**Interfaces:**

- Consumes: existing onboarding draft types and `useVerificationFlow().invalidateApplicant()` from Task 2.
- Produces: `SubmitApplicantInput`, `OnboardingGateway.submitApplicant(input)`, and one live V2 submission after step 6.

- [ ] **Step 1: Write HTTP onboarding gateway tests**

Define the feature input using UI-domain values:

```ts
const input: SubmitApplicantInput = {
  occupation: { id: 11, name: 'Accountant' },
  yearlyIncome: 'USD 50,000 – 100,000',
  monthlySpend: 'USD 1,000 – 5,000',
  accountPurpose: 'Personal spending',
}
```

Assert all four purpose mappings with `test.each` and this exact request shape:

```ts
expect(request).toHaveBeenCalledWith('cards/applicant/', {
  authenticated: true,
  method: 'POST',
  retry: false,
  json: {
    occupation: 11,
    salary: 'USD 50,000 – 100,000',
    volume: 'USD 1,000 – 5,000',
    purpose: 'personal',
  },
})
```

Assert request rejection returns `{ ok: false, code: 'applicant-submit-failed', message: 'Something went wrong. Please try again.' }` without exposing the raw backend body.

- [ ] **Step 2: Run gateway tests and verify failure**

Run: `pnpm test src/features/onboarding/api/http-onboarding-gateway.test.ts`

Expected: FAIL because the HTTP onboarding gateway does not exist.

- [ ] **Step 3: Replace the step gateway with the final-submit boundary**

Use:

```ts
export interface SubmitApplicantInput {
  occupation: Occupation
  yearlyIncome: YearlyIncome
  monthlySpend: MonthlySpend
  accountPurpose: AccountPurpose
}

export interface OnboardingGateway {
  submitApplicant(input: SubmitApplicantInput): Promise<GatewayResult>
}
```

Keep the purpose mapping private to the HTTP gateway. Do not add residency or agreement fields to `SubmitApplicantInput`.

- [ ] **Step 4: Write provider tests for local steps and final submission**

Drive all six steps through `useOnboardingFlow` and assert `submitApplicant` has zero calls after steps 1–5. After selecting agreements on step 6, assert one call with the complete UI-domain input. Add tests proving a failed final call stays on step 6, exposes only the generic message, and a second button action produces exactly one additional call. Retain the occupation debounce test.

- [ ] **Step 5: Run provider tests and verify failure**

Run: `pnpm test src/features/onboarding/onboarding-flow-provider.test.tsx`

Expected: FAIL because the provider still calls `saveStep` on every step.

- [ ] **Step 6: Make steps 1–5 local and submit only step 6**

Remove `createStepPayload`. After `validateOnboardingStep(state)` succeeds:

```ts
if (state.step !== 6) {
  dispatch({ type: 'submissionSucceeded' })
  return true
}

const input = createSubmitApplicantInput(state)
if (input === null) return false
```

Only set `submission: 'pending'` around `gateway.submitApplicant(input)` on step 6. Keep the existing `pendingRef` duplicate-click guard and generic catch behavior. Steps 1–5 must not briefly enter pending state.

- [ ] **Step 7: Make app completion invalidate applicant state before replacement**

Allow `completeOnboarding` to await `onCompleted(): void | Promise<void>`. In the onboarding route, call `await invalidateApplicant()` and then `completeOnboarding(router.history)`. This GET uses the existing retry mechanism and cannot trigger a second applicant POST. Root must keep the onboarding result mounted until the refresh settles, then replace with `/verification` from the route policy.

- [ ] **Step 8: Wire the live V2 gateway and remove mocks**

Create `onboardingGateway = createHttpOnboardingGateway(v2Client)` in app composition, pass it to `OnboardingFlowProvider`, delete the mock import/files, and update root mocks in `root-route.test.tsx` to mock the HTTP gateway factory.

- [ ] **Step 9: Run Task 4 tests and commit**

Run:

```bash
pnpm test src/features/onboarding/api/http-onboarding-gateway.test.ts src/features/onboarding/onboarding-flow-provider.test.tsx src/features/onboarding/complete-onboarding.test.ts src/app/root-route.test.tsx
pnpm typecheck
git diff --check
```

Expected: all commands PASS and no source import references `mockOnboardingGateway`.

Commit:

```bash
git add src/features/onboarding src/app/routes/onboarding.tsx src/app/root-route.tsx src/app/root-route.test.tsx
git commit -m "feat: submit real onboarding applicant"
```

### Task 5: Verification Introduction and Status Views

**Files:**

- Create: `src/features/verification/continue-verification-view.tsx`
- Create: `src/features/verification/continue-verification-view.test.tsx`
- Modify: `src/features/verification/verification-status-view.tsx`
- Modify: `src/features/verification/verification-status-view.test.tsx`

**Interfaces:**

- Consumes: shared `FlowHeading`, `Button`, and the approved Figma nodes.
- Produces: `ContinueVerificationView` and `VerificationStatusView` accepting `'under-review' | 'verified' | 'rejected'`.

- [ ] **Step 1: Write view tests from Figma content**

For Continue, assert the exact node `573:13792` content: eyebrow `Application · Identity`, title `Continue identity verification`, description `Three steps, about three minutes.`, and button `Continue verification`. Assert a real `button`, disabled/loading behavior, and generic error rendering with `role="alert"`.

For statuses, retain the current Under review and Verified assertions. Add exact rejected assertions from node `293:44010`: title `We could not open your account`, description `We are not able to proceed at this time. Support can tell you what is needed and whether it can be resolved.`, `Identity — Rejected`, and `Application — Closed`. Assert Limit, Card, and Annual membership are absent from Rejected. Raw `reject_comment` is not a prop and cannot be rendered.

- [ ] **Step 2: Run view tests and verify failure**

Run:

```bash
pnpm test src/features/verification/continue-verification-view.test.tsx src/features/verification/verification-status-view.test.tsx
```

Expected: FAIL because Continue and rejected views are absent.

- [ ] **Step 3: Implement the Continue view**

Use this prop boundary:

```ts
interface ContinueVerificationViewProps {
  pending: boolean
  error: string | null
  onContinue(): void
}
```

Build the layout from Figma node `573:13792` using the existing `FlowHeading`, shared `Button`, and Tailwind utilities. Keep a single column, `min-w-0`, 16px mobile horizontal padding, and no fixed page width.

- [ ] **Step 4: Extend status content without changing existing rows**

Change the status prop to:

```ts
type VerificationStatusViewState = 'under-review' | 'verified' | 'rejected'
```

Add the rejected content from node `293:44010` to the existing `statusContent` record. Under review and Verified reuse the exact current Limit, Card, and Annual membership array. Rejected renders only its Identity and Application rows. Do not add transitions or animations.

- [ ] **Step 5: Compare component markup and commit**

Run:

```bash
pnpm test src/features/verification/continue-verification-view.test.tsx src/features/verification/verification-status-view.test.tsx
pnpm typecheck
git diff --check
```

Expected: all commands PASS.

Commit:

```bash
git add src/features/verification/continue-verification-view.tsx src/features/verification/continue-verification-view.test.tsx src/features/verification/verification-status-view.tsx src/features/verification/verification-status-view.test.tsx
git commit -m "feat: add verification state views"
```

### Task 6: Sumsub React SDK Wrapper

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/features/verification/sumsub-web-sdk-view.tsx`
- Create: `src/features/verification/sumsub-web-sdk-view.test.tsx`

**Interfaces:**

- Consumes: the official `SumsubWebSdk` React component.
- Produces: a project-owned wrapper that emits only `onSubmitted` and `onFailed` intents and accepts a token-expiration callback.

- [ ] **Step 1: Install the approved dependency**

Run: `pnpm add @sumsub/websdk-react@2.9.0`

Expected: `package.json` and `pnpm-lock.yaml` contain `@sumsub/websdk-react`; no unrelated dependency changes appear.

- [ ] **Step 2: Write the SDK wrapper test**

Mock `@sumsub/websdk-react`, capture its props, and assert:

- `accessToken` is passed unchanged;
- `expirationHandler` is the supplied async callback;
- `config` selects English and the dark Sumsub theme without custom CSS;
- `options` contains `addViewportTag: false` and `adaptIframeHeight: true`;
- `onMessage('idCheck.onApplicantSubmitted', {})` invokes `onSubmitted`;
- `onMessage('idCheck.onApplicantResubmitted', {})` invokes `onSubmitted`;
- unrelated SDK messages do nothing;
- `onError` invokes `onFailed` without forwarding raw error text.

- [ ] **Step 3: Run the wrapper test and verify failure**

Run: `pnpm test src/features/verification/sumsub-web-sdk-view.test.tsx`

Expected: FAIL because the project wrapper does not exist.

- [ ] **Step 4: Implement the thin wrapper**

Use:

```tsx
interface SumsubWebSdkViewProps {
  accessToken: string
  onTokenExpired(): Promise<string>
  onSubmitted(): void
  onFailed(): void
}

export function SumsubWebSdkView(props: SumsubWebSdkViewProps) {
  const onMessage = (type: string) => {
    if (
      type === 'idCheck.onApplicantSubmitted' ||
      type === 'idCheck.onApplicantResubmitted'
    ) {
      props.onSubmitted()
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-clip">
      <SumsubWebSdk
        accessToken={props.accessToken}
        expirationHandler={props.onTokenExpired}
        config={{ lang: 'en', theme: 'dark' }}
        options={{ addViewportTag: false, adaptIframeHeight: true }}
        onMessage={onMessage}
        onError={props.onFailed}
      />
    </div>
  )
}
```

Adapt callback parameter types to the installed package declarations without using `any`, `@ts-ignore`, or unsafe assertions.

- [ ] **Step 5: Run wrapper checks and commit**

Run:

```bash
pnpm test src/features/verification/sumsub-web-sdk-view.test.tsx
pnpm typecheck
pnpm lint
git diff --check
```

Expected: all commands PASS.

Commit:

```bash
git add package.json pnpm-lock.yaml src/features/verification/sumsub-web-sdk-view.tsx src/features/verification/sumsub-web-sdk-view.test.tsx
git commit -m "feat: add Sumsub WebSDK wrapper"
```

### Task 7: Internal SDK Route and Navigation

**Files:**

- Create: `src/features/verification/sumsub-verification-screen.tsx`
- Create: `src/features/verification/sumsub-verification-screen.test.tsx`
- Create: `src/app/routes/verification.sumsub.tsx`
- Modify: `src/app/navigation.ts`
- Modify: `src/app/navigation.test.ts`
- Modify: `src/app/protected-route-guard.test.ts`
- Generate: `src/app/routeTree.gen.ts`

**Interfaces:**

- Consumes: `useVerificationFlow()` from Task 2 and `SumsubWebSdkView` from Task 6.
- Produces: `/verification/sumsub`, browser-Back-compatible entry navigation, and replacement navigation after submit/error.

- [ ] **Step 1: Add navigation tests**

Extend the memory-history suite:

```ts
const history = createMemoryHistory({ initialEntries: ['/verification'] })
startSumsubVerification(history)
history.flush()
expect(history.location.pathname).toBe('/verification/sumsub')
expect(history.canGoBack()).toBe(true)
history.back()
history.flush()
expect(history.location.pathname).toBe('/verification')
```

Add a second test proving `finishSumsubVerification(history)` replaces the SDK entry with `/verification` and Back cannot reopen `/verification/sumsub`.

- [ ] **Step 2: Implement navigation helpers**

Expand the history type to include `push`. Add:

```ts
export function startSumsubVerification(history: AppHistory) {
  history.push('/verification/sumsub')
}

export function finishSumsubVerification(history: AppHistory) {
  history.replace('/verification')
}
```

Do not change existing onboarding, verification completion, authentication, or home-child policies.

- [ ] **Step 3: Write SDK screen orchestration tests**

Mock `useVerificationFlow` and `SumsubWebSdkView`. Assert:

- cached token renders the SDK immediately;
- direct route without a token calls `prepareToken()` and shows the shared loader until ready;
- token preparation failure marks an attempt failure and replaces `/verification`;
- SDK submit calls `markSubmitted()` before `clearToken()` and route replacement;
- SDK error calls `markAttemptFailed()`, clears the token, and replaces `/verification` without setting submitted;
- expiration calls `refreshToken()` and returns its token string;
- expiration refresh failure marks the attempt failed, clears the token, replaces `/verification`, and rejects with only the generic feature error.

- [ ] **Step 4: Implement the SDK screen**

Use a route callback boundary:

```ts
interface SumsubVerificationScreenProps {
  onExit(): void
}
```

On mount, prepare a token only when none is cached. On submit, synchronously call `markSubmitted()`, then `clearToken()`, then `onExit()`. On SDK/token failure, call `markAttemptFailed()`, clear the token, and exit. Wrap `refreshToken()` so a refresh rejection runs the same failure path and throws a new `Error('Something went wrong. Please try again.')` to the SDK. Render no raw error.

- [ ] **Step 5: Add the protected file route**

Create `verification.sumsub.tsx` with `createFileRoute('/verification/sumsub')`, `beforeLoad: requireStoredAuthSession`, and a component that passes `finishSumsubVerification(router.history)` to the SDK screen.

Add the route to the `protectedRoutes` table in `protected-route-guard.test.ts`.

- [ ] **Step 6: Regenerate the route tree**

Run: `pnpm build`

Expected: build PASS and `src/app/routeTree.gen.ts` contains the generated `/verification/sumsub` route. Do not edit the generated file manually.

- [ ] **Step 7: Run Task 7 tests and commit**

Run:

```bash
pnpm test src/app/navigation.test.ts src/features/verification/sumsub-verification-screen.test.tsx src/app/protected-route-guard.test.ts
pnpm typecheck
git diff --check
```

Expected: all commands PASS.

Commit:

```bash
git add src/app/navigation.ts src/app/navigation.test.ts src/app/routes/verification.sumsub.tsx src/app/protected-route-guard.test.ts src/app/routeTree.gen.ts src/features/verification/sumsub-verification-screen.tsx src/features/verification/sumsub-verification-screen.test.tsx
git commit -m "feat: add Sumsub verification route"
```

### Task 8: Real Verification Screen and Polling

**Files:**

- Create: `src/features/verification/use-document-visibility.ts`
- Create: `src/features/verification/use-document-visibility.test.ts`
- Rewrite: `src/features/verification/verification-screen.tsx`
- Create: `src/features/verification/verification-screen.test.tsx`
- Modify: `src/app/routes/verification.tsx`
- Delete: `src/features/verification/api/verification-gateway.ts`
- Delete: `src/features/verification/api/mock-verification-gateway.ts`
- Delete: `src/features/verification/api/mock-verification-gateway.test.ts`

**Interfaces:**

- Consumes: `useVerificationFlow`, `deriveVerificationViewState`, Continue/status views, `scheduleHomeRedirect`, and `startSumsubVerification`.
- Produces: real `/verification` behavior, 3-second visible-tab polling, and two-second Rain-approved completion.

- [ ] **Step 1: Write visibility-hook tests**

Use an injectable document-like object with `visibilityState`, `addEventListener`, and `removeEventListener`. Assert initial visible/hidden state, one update per `visibilitychange`, and listener cleanup on unmount.

- [ ] **Step 2: Implement the visibility hook**

Use this callable boundary:

```ts
type VisibilityDocument = Pick<
  Document,
  'visibilityState' | 'addEventListener' | 'removeEventListener'
>

export function useDocumentVisibility(
  target: VisibilityDocument = document,
): boolean
```

Return a boolean `documentVisible`. Read `target.visibilityState !== 'hidden'`, subscribe to `visibilitychange`, and remove the exact listener during cleanup. Do not subscribe at module import time.

- [ ] **Step 3: Write verification-screen tests**

With fake timers and a mocked verification-flow context, cover:

- `not_started` renders Continue and starts token prefetch but no applicant polling;
- token error and consumed SDK attempt error render `Something went wrong. Please try again.`;
- Continue retries token and calls `onStartSdk` only after token success;
- `temporary_rejected` behaves like Continue;
- local submitted latch with stale `not_started` renders Under review;
- Sumsub `pending` renders Under review;
- Sumsub `approved` with Rain pending renders Under review;
- Rain `needsInformation`, `needsVerification`, and `manualReview` remain Under review;
- Sumsub `rejected` and Rain `denied`, `locked`, and `canceled` render Rejected and never poll;
- Rain approval renders Account pending, stops polling, waits exactly 2,000 ms, then calls `onCompleted` once;
- Under review performs an immediate refetch, then one refetch per 3,000 visible milliseconds;
- hiding the document clears the interval; showing it performs one immediate refetch and restarts the interval;
- unmount clears polling and the home redirect timer.

- [ ] **Step 4: Run screen tests and verify failure**

Run:

```bash
pnpm test src/features/verification/use-document-visibility.test.ts src/features/verification/verification-screen.test.tsx
```

Expected: FAIL because the current screen still waits on a mock gateway.

- [ ] **Step 5: Implement real screen state and token introduction**

Use this route-facing boundary:

```ts
interface VerificationScreenProps {
  onStartSdk(): void
  onCompleted(): void
}
```

Read applicant/token/session state from `useVerificationFlow()`. Throw `applicantError` only after applicant loading has ended in error. Render nothing while applicant is absent from initial loading; root owns that loading surface. Render Continue, Under review, Verified, or Rejected from `deriveVerificationViewState(applicant, submitted)`.

On Continue mount, call `prepareToken()` in the background. On button press, reuse a prepared token or await `prepareToken()`; call `onStartSdk()` only when it returns true. Clear the one-shot attempt error when it is consumed, and keep current token-query errors visible until the next button attempt.

- [ ] **Step 6: Implement visible-tab polling**

For `state === 'under-review' && documentVisible`, call `refetchApplicant()` immediately and start:

```ts
const interval = globalThis.setInterval(() => {
  void refetchApplicant()
}, 3_000)

return () => globalThis.clearInterval(interval)
```

The effect dependencies must include the derived state, visibility, and stable refetch callback. No interval exists for Continue, Verified, or Rejected.

- [ ] **Step 7: Implement Rain-approved redirect and real route composition**

Reuse `scheduleHomeRedirect(onCompleted)` only for `state === 'verified'`. In `routes/verification.tsx`, remove the mock gateway, pass `startSumsubVerification(router.history)` as `onStartSdk`, and retain `completeVerification(router.history)` as `onCompleted`.

Delete the obsolete verification gateway/mock files only after no imports remain.

- [ ] **Step 8: Run Task 8 tests and commit**

Run:

```bash
pnpm test src/features/verification/use-document-visibility.test.ts src/features/verification/verification-screen.test.tsx src/features/verification/verification-status-view.test.tsx src/features/verification/schedule-home-redirect.test.ts src/app/navigation.test.ts src/app/protected-route-guard.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

Expected: all commands PASS and `rg "mockVerificationGateway|waitForVerification" src` returns no matches.

Commit:

```bash
git add src/features/verification src/app/routes/verification.tsx src/app/navigation.ts src/app/navigation.test.ts src/app/protected-route-guard.test.ts
git commit -m "feat: poll real verification status"
```

### Task 9: Integration Regression and Mobile/Figma Verification

**Files:**

- Modify: `src/app/root-route.test.tsx`
- Modify: `src/app/navigation.test.ts`
- Modify: focused verification/onboarding tests only when an integration gap is demonstrated
- Inspect: `src/app/routeTree.gen.ts`
- Inspect: `package.json`
- Inspect: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: every deliverable from Tasks 1–8.
- Produces: a verified end-to-end frontend flow with no application mocks for onboarding or verification.

- [ ] **Step 1: Add the cross-feature routing regression**

Extend the root/app-route test harness to prove this sequence with controlled gateways:

1. authenticated applicant GET returns 404 and root allows `/onboarding`;
2. onboarding steps 1–5 make no applicant POST;
3. step 6 produces one V2 POST;
4. applicant invalidation returns `not_started` with `sumsub_id` and root allows `/verification`;
5. Continue prepares one token and pushes `/verification/sumsub`;
6. `idCheck.onApplicantSubmitted` sets the latch and replaces `/verification`;
7. stale `not_started` stays Under review;
8. later Sumsub `approved` with Rain pending stays Under review;
9. Rain approval shows Account pending and replaces `/home` after 2,000 ms.

Keep the integration test at public feature/app boundaries; do not assert private reducer implementation details.

- [ ] **Step 2: Run the new regression and fix only demonstrated gaps**

Run: `pnpm test src/app/root-route.test.tsx src/features/onboarding/onboarding-flow-provider.test.tsx src/features/verification/verification-screen.test.tsx src/features/verification/sumsub-verification-screen.test.tsx`

Expected: PASS. If it fails, make the smallest change in the owning file and add the focused assertion that reproduces the gap.

- [ ] **Step 3: Run the complete automated verification suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits 0. Confirm the build-generated route tree contains `/verification/sumsub` and no generated file was hand-edited.

- [ ] **Step 4: Confirm mock and backend scope**

Run:

```bash
rg "mockOnboardingGateway|mockVerificationGateway|waitForVerification" src
git status --short
git diff --stat c1a49a0..HEAD
```

Expected: the first command has no matches; the diff contains frontend files only; no backend worktree file is modified.

- [ ] **Step 5: Perform mobile browser verification**

Start the app with `pnpm dev`. At 320px and the Figma mobile viewport:

- compare `/verification` Continue to node `573:13792`;
- compare Under review, Verified, and Rejected to node `293:43925`;
- confirm header/footer are from `PrivatePageShell` and browser chrome is absent;
- enter `/verification/sumsub`, confirm iframe width never overflows, and use browser Back to return to Continue;
- trigger submit in a configured Sumsub sandbox, confirm immediate replacement to Checking your identity, and verify the network shows one applicant GET every three visible seconds;
- background and foreground the tab, confirm no hidden polling and one immediate foreground GET;
- verify camera/file controls and virtual-keyboard behavior on a real mobile browser or embedded WebView.

- [ ] **Step 6: Review the final diff and commit verification adjustments**

Run:

```bash
git diff --check
git status --short
```

Commit any Task 9 test or visual corrections:

```bash
git add src package.json pnpm-lock.yaml
git commit -m "test: verify applicant onboarding flow"
```

If Task 9 required no file changes, do not create an empty commit.
