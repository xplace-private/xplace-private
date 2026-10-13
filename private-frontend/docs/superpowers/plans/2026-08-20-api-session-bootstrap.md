# API Session Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable Ky HTTP client and TanStack Query session bootstrap that validates stored tokens through `GET /api/v1/users/me/`, guards routes, and renders stable Home loading geometry.

**Architecture:** Feature gateways consume a shared `ApiClient`; Ky alone owns transport retries and TanStack Query alone owns in-memory server data. The observable token store drives a single auth/session provider, while the root route gate derives redirects and loading UI from the validated session rather than token presence.

**Tech Stack:** React 19, strict TypeScript 6, Vite 8, TanStack Router, `ky`, `@tanstack/react-query`, Vitest, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-20-api-session-bootstrap-design.md`

## Global Constraints

- Ky performs one initial request plus at most 10 retries; TanStack Query automatic retry remains disabled.
- Retry only non-aborted network failures, HTTP 408, HTTP 429, and HTTP 5xx responses.
- Backoff starts at 300 ms, is capped at 10 seconds, and uses jitter.
- OTP send and OTP verification requests explicitly disable retry.
- Authenticated HTTP 401 clears the token session immediately and is never retried; HTTP 403 is never retried and does not log out globally.
- Access and refresh tokens remain in `localStorage`; `CurrentUser` remains only in TanStack Query's memory cache.
- Development, staging, and production require `VITE_API_BASE_URL`; backed auth features never fall back to runtime mocks.
- Onboarding, verification, and payment-plan mocks remain unchanged until those backend contracts are connected.
- Every untrusted HTTP body is parsed as `unknown` and validated inside its owning feature.
- Preserve email OTP, resend countdown, rate-limit copy, button loading, and anti-spam behavior.
- Support 320 CSS px and verify Home skeleton geometry at both 320 px and 375 px.
- Do not add a response-schema package or migrate unrelated mocked gateways.

---

## File Structure

### New files

- `src/shared/api/api-client.ts` — transport-neutral interface, typed transport error, and Ky-backed implementation.
- `src/shared/api/api-client.test.ts` — retry, auth header, abort, unauthorized, and JSON behavior.
- `src/shared/api/api-base-urls.ts` — derives legacy and v1 bases from the configured environment.
- `src/shared/api/api-base-urls.test.ts` — local proxy and absolute-origin URL cases.
- `src/features/auth/api/current-user-gateway.ts` — `CurrentUser` model and gateway contract.
- `src/features/auth/api/http-current-user-gateway.ts` — v1 request and strict response validation.
- `src/features/auth/api/http-current-user-gateway.test.ts` — request contract and malformed-body cases.
- `src/features/auth/current-user-query.ts` — stable query key, safe query error, and Query options.
- `src/features/auth/current-user-query.test.ts` — result-to-query-error adaptation and retry ownership.
- `src/features/auth/components/session-recovery.tsx` — retry/sign-out UI after session restoration fails.
- `src/features/auth/components/session-recovery.test.tsx` — recovery actions, pending state, and anti-spam behavior.
- `src/shared/ui/skeleton.tsx` — local shadcn-style skeleton primitive.
- `src/features/home/home-session-skeleton.tsx` — Home-shaped bootstrap skeleton.
- `src/features/home/home-session-skeleton.test.tsx` — shared geometry and accessibility assertions.

### Modified files

- `package.json`, `pnpm-lock.yaml` — add Ky and TanStack Query.
- `src/features/auth/api/browser-auth-session-store.ts` and test — readable, observable token state.
- `src/features/auth/api/http-otp-gateway.ts` and test — use `ApiClient`, preserve feature parsing, disable retry.
- `src/features/auth/auth-screen.test.tsx` — replace the removed runtime auth mock with a test-local fake.
- `src/features/auth/auth-flow-provider.tsx` and test — validate session with Query and sequence OTP → tokens → user.
- `src/features/auth/model/auth-flow.ts` and test — remove token-presence authentication from form reducer.
- `src/features/home/home-screen.tsx` — expose/reuse stable outer Home geometry.
- `src/shared/api/app-env.ts` and test — require API configuration in every runtime build mode.
- `src/app/root-route.tsx` and test — Query provider, API composition, guards, skeleton, and redirects.
- `src/app/home-route.tsx` and test — use validated session state for payment data and logout.

### Deleted files

- `src/features/auth/api/mock-auth-gateway.ts` — removed in Task 6 when root composition switches atomically to real auth clients.
- `src/features/auth/api/mock-auth-gateway.test.ts` — removed with its production mock in Task 6.

---

### Task 1: Add the reusable Ky API client

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/shared/api/api-client.ts`
- Create: `src/shared/api/api-client.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  json?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  authenticated?: boolean
  retry?: boolean
}

export interface ApiClient {
  request(path: string, options?: ApiRequestOptions): Promise<unknown>
}

export class ApiRequestError extends Error {
  readonly kind: 'http' | 'network' | 'aborted' | 'invalid-response'
  readonly status: number | null
  readonly body: unknown
}

export interface ApiClientOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
  getAccessToken?: () => string | null
  onUnauthorized?: () => void
}

export function createApiClient(options: ApiClientOptions): ApiClient
export function isApiRequestError(error: unknown): error is ApiRequestError
```

- Consumes: native `fetch`, `AbortSignal`, and the approved Ky dependency.

- [ ] **Step 1: Install the approved dependencies**

Run:

```bash
pnpm add ky @tanstack/react-query
```

Expected: `package.json` and `pnpm-lock.yaml` contain both runtime dependencies without unrelated upgrades.

- [ ] **Step 2: Write failing transport tests**

Add focused tests covering URL joining, JSON, and authentication:

```ts
test('joins a relative endpoint and adds bearer auth only when requested', async () => {
  const requests: Request[] = []
  const client = createApiClient({
    baseUrl: 'https://back-stage.x.place/api/v1',
    getAccessToken: () => 'access-token',
    fetch: async (input, init) => {
      requests.push(new Request(input, init))
      return Response.json({ id: 2 })
    },
  })

  await client.request('users/me/', { authenticated: true })

  expect(requests[0]?.url).toBe('https://back-stage.x.place/api/v1/users/me/')
  expect(requests[0]?.headers.get('Authorization')).toBe('Bearer access-token')
})
```

Add retry tests using fake timers and a deterministic `Math.random` spy:

```ts
test('performs one request plus ten retries for a retryable GET', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(1)
  let attempts = 0
  const client = createApiClient({
    baseUrl: '/api',
    fetch: async () => {
      attempts += 1
      return new Response('{}', { status: 503 })
    },
  })

  const request = client.request('users/me/')
  await vi.runAllTimersAsync()
  await expect(request).rejects.toMatchObject({ status: 503 })
  expect(attempts).toBe(11)
})

test('does not retry when retry is disabled', async () => {
  let attempts = 0
  const client = createApiClient({
    baseUrl: '/api',
    fetch: async () => {
      attempts += 1
      return new Response('{}', { status: 503 })
    },
  })

  await expect(client.request('otp/', { method: 'POST', retry: false })).rejects.toBeDefined()
  expect(attempts).toBe(1)
})
```

Also assert: `408`, `429`, and representative `500`/`599` retry; `400`, `401`, `403`, and `404` do not; POST defaults to no retry; aborted requests expose `kind: 'aborted'`; authenticated `401` invokes `onUnauthorized` exactly once before rejection.

- [ ] **Step 3: Run the test to prove the client is missing**

Run:

```bash
pnpm test -- src/shared/api/api-client.test.ts
```

Expected: FAIL because `./api-client` does not exist.

- [ ] **Step 4: Implement the minimal Ky adapter**

Use one policy constant and method safety check:

```ts
const RETRY_LIMIT = 10
const RETRY_BACKOFF_LIMIT_MS = 10_000
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE'])

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599)
}

function retryEnabled(options: ApiRequestOptions): boolean {
  const method = options.method ?? 'GET'
  return options.retry ?? SAFE_RETRY_METHODS.has(method)
}
```

Create the request URL with the existing relative-path behavior:

```ts
function createRequestUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.replace(/^\/+/, '')
  return normalizedBase.startsWith('/')
    ? `${normalizedBase}/${normalizedPath}`
    : new URL(normalizedPath, `${normalizedBase}/`).href
}
```

Configure Ky per request with `limit: 10`, `delay: attempt => Math.min(300 * 2 ** (attempt - 1), 10_000)`, `backoffLimit: 10_000`, jitter, the approved statuses, and `retry: 0` when retry is disabled. Catch Ky HTTP/network/timeout errors and translate them to `ApiRequestError`; parse an error response body as `unknown` without assuming JSON. Call `onUnauthorized` only when `authenticated === true && status === 401`.

- [ ] **Step 5: Run transport tests**

Run:

```bash
pnpm test -- src/shared/api/api-client.test.ts
```

Expected: PASS with 11 total attempts for retry-enabled failures and one attempt for disabled/unauthorized failures.

- [ ] **Step 6: Commit the shared transport**

```bash
git add package.json pnpm-lock.yaml src/shared/api/api-client.ts src/shared/api/api-client.test.ts
git commit -m "feat: add reusable API client"
```

---

### Task 2: Make tokens observable and compose legacy/v1 base URLs

**Files:**
- Modify: `src/features/auth/api/browser-auth-session-store.ts`
- Modify: `src/features/auth/api/browser-auth-session-store.test.ts`
- Create: `src/shared/api/api-base-urls.ts`
- Create: `src/shared/api/api-base-urls.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AuthSessionStore {
  readTokens(): AuthTokens | null
  saveTokens(tokens: AuthTokens): void
  clear(): void
  subscribe(listener: () => void): () => void
}

export interface ApiBaseUrls {
  legacy: string
  v1: string
}

export function createApiBaseUrls(apiBaseUrl: string): ApiBaseUrls
```

- Consumes: `AuthTokens` and the environment's normalized `apiBaseUrl`.

- [ ] **Step 1: Extend the token-store tests first**

Replace token-presence assertions with exact reads and notifications:

```ts
test('reads complete tokens and notifies save and clear subscribers', () => {
  const store = createBrowserAuthSessionStore(createMemoryStorage())
  const listener = vi.fn()
  const unsubscribe = store.subscribe(listener)

  expect(store.readTokens()).toBeNull()
  store.saveTokens({ access: 'demo-access', refresh: 'demo-refresh' })
  expect(store.readTokens()).toEqual({ access: 'demo-access', refresh: 'demo-refresh' })
  store.clear()
  expect(store.readTokens()).toBeNull()
  expect(listener).toHaveBeenCalledTimes(2)

  unsubscribe()
  store.saveTokens({ access: 'next-access', refresh: 'next-refresh' })
  expect(listener).toHaveBeenCalledTimes(2)
})
```

Keep malformed/blank token cases returning `null`.

- [ ] **Step 2: Add failing base-URL tests**

```ts
test('uses the same local proxy base for legacy and v1 clients', () => {
  expect(createApiBaseUrls('/api')).toEqual({ legacy: '/api', v1: '/api' })
})

test('adds api/v1 only to an absolute v1 base', () => {
  expect(createApiBaseUrls('https://back-stage.x.place')).toEqual({
    legacy: 'https://back-stage.x.place',
    v1: 'https://back-stage.x.place/api/v1',
  })
})
```

- [ ] **Step 3: Run both focused tests and confirm failure**

Run:

```bash
pnpm test -- src/features/auth/api/browser-auth-session-store.test.ts src/shared/api/api-base-urls.test.ts
```

Expected: FAIL because `readTokens`, `subscribe`, and `createApiBaseUrls` are absent.

- [ ] **Step 4: Implement observable token reads and URL derivation**

Keep listeners private to each store instance:

```ts
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
```

`readTokens()` returns `null` unless both stored strings contain non-whitespace text. `saveTokens()` and `clear()` perform the existing guarded storage operations and then notify. `subscribe()` returns an unsubscribe closure.

`createApiBaseUrls()` returns the relative base unchanged for local proxy mode and uses `new URL('api/v1/', absoluteOrigin)` for absolute bases, removing only the final slash.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm test -- src/features/auth/api/browser-auth-session-store.test.ts src/shared/api/api-base-urls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit session storage and URL composition**

```bash
git add src/features/auth/api/browser-auth-session-store.ts src/features/auth/api/browser-auth-session-store.test.ts src/shared/api/api-base-urls.ts src/shared/api/api-base-urls.test.ts
git commit -m "feat: expose observable auth tokens"
```

---

### Task 3: Migrate OTP transport without changing auth behavior

**Files:**
- Modify: `src/features/auth/api/http-otp-gateway.ts`
- Modify: `src/features/auth/api/http-otp-gateway.test.ts`
- Modify: `src/features/auth/auth-screen.test.tsx`

**Interfaces:**
- Consumes: `ApiClient.request(path, options)` from Task 1.
- Produces:

```ts
export function createHttpOtpGateway(
  apiClient: ApiClient,
): Pick<AuthGateway, 'requestCode' | 'requestEmailCode' | 'verifyOtp'>
```

- [ ] **Step 1: Replace fetch-oriented tests with an `ApiClient` probe**

Use a recorder that returns queued unknown bodies or throws `ApiRequestError`:

```ts
const requests: Array<{ path: string; options?: ApiRequestOptions }> = []
const apiClient: ApiClient = {
  async request(path, options) {
    requests.push({ path, options })
    return { success: true, message: 'Code sent', user_id: 42 }
  },
}

const gateway = createHttpOtpGateway(apiClient)
await gateway.requestEmailCode({ email: '  Yury+1@x.place  ' })

expect(requests[0]).toEqual({
  path: 'users/register/email/',
  options: {
    method: 'POST',
    json: { email: 'Yury+1@x.place' },
    retry: false,
  },
})
```

Assert the phone payload stays unchanged, verification sends `{ otp, user_id }`, all three calls set `retry: false`, token parsing remains strict, and rate-limit data is read from `ApiRequestError.body` when HTTP status is 429.

- [ ] **Step 2: Run the OTP gateway test and confirm the constructor mismatch**

Run:

```bash
pnpm test -- src/features/auth/api/http-otp-gateway.test.ts
```

Expected: FAIL because `createHttpOtpGateway` still accepts a base URL and fetch function.

- [ ] **Step 3: Refactor the gateway to `ApiClient`**

Replace direct `fetch` calls with:

```ts
apiClient.request('users/register/email/', {
  method: 'POST',
  json: { email: normalizeEmail(email) },
  retry: false,
})
```

In each catch block, use `isApiRequestError(error) ? error.body : undefined` as the untrusted error body. Keep `readOtpResponse`, `readAuthTokens`, `readOtpRetryFailure`, safe fallback messages, and `GatewayResult` codes feature-owned and unchanged.

Replace the `mockAuthGateway` import in `auth-screen.test.tsx` with a test-local `AuthGateway` fixture that returns the same deterministic success values. Keep the production mock temporarily because root still consumes it; Task 6 removes the mock atomically with real root client composition.

- [ ] **Step 4: Run all auth gateway/model tests**

Run:

```bash
pnpm test -- src/features/auth/api src/features/auth/model src/features/auth/auth-screen.test.tsx
```

Expected: PASS, including plus-addressed email normalization, 60-second resend behavior, long rate-limit formatting, and auth token validation.

- [ ] **Step 5: Commit the OTP migration**

```bash
git add src/features/auth/api/http-otp-gateway.ts src/features/auth/api/http-otp-gateway.test.ts src/features/auth/auth-screen.test.tsx
git commit -m "refactor: use shared client for OTP auth"
```

---

### Task 4: Add CurrentUser gateway and Query contract

**Files:**
- Create: `src/features/auth/api/current-user-gateway.ts`
- Create: `src/features/auth/api/http-current-user-gateway.ts`
- Create: `src/features/auth/api/http-current-user-gateway.test.ts`
- Create: `src/features/auth/current-user-query.ts`
- Create: `src/features/auth/current-user-query.test.ts`

**Interfaces:**
- Consumes: `ApiClient` and `GatewayResult`.
- Produces:

```ts
export interface CurrentUser {
  id: number
  username: string | null
  email: string
  avatar: string | null
}

export interface CurrentUserGateway {
  get(signal?: AbortSignal): Promise<GatewayResult<CurrentUser>>
}

export const CURRENT_USER_QUERY_KEY = ['auth', 'current-user'] as const
export class CurrentUserQueryError extends Error {
  readonly code: string
}
export function currentUserQueryOptions(gateway: CurrentUserGateway): ReturnType<typeof queryOptions<CurrentUser>>
```

- [ ] **Step 1: Write strict current-user gateway tests**

```ts
test('loads the authenticated current user from users/me', async () => {
  const request = vi.fn().mockResolvedValue({
    id: 2,
    username: 'alex.morgan',
    email: 'user@example.com',
    avatar: null,
  })
  const gateway = createHttpCurrentUserGateway({ request })

  await expect(gateway.get()).resolves.toEqual({
    ok: true,
    data: {
      id: 2,
      username: 'alex.morgan',
      email: 'user@example.com',
      avatar: null,
    },
  })
  expect(request).toHaveBeenCalledWith('users/me/', {
    authenticated: true,
    signal: undefined,
  })
})
```

Use a table to reject: negative/fractional/string ids; missing, blank, or non-string email; non-string/non-null username; and non-string/non-null avatar. Assert failures use `code: 'current-user-failed'` and `message: 'Unable to restore session. Try again.'`.

- [ ] **Step 2: Write Query adapter tests**

```ts
test('disables Query retry and throws a safe typed error for a gateway failure', async () => {
  const gateway: CurrentUserGateway = {
    get: () => Promise.resolve({
      ok: false,
      code: 'current-user-failed',
      message: 'Unable to restore session. Try again.',
    }),
  }
  const options = currentUserQueryOptions(gateway)

  expect(options.queryKey).toEqual(CURRENT_USER_QUERY_KEY)
  expect(options.retry).toBe(false)
  await expect(options.queryFn?.({ signal: new AbortController().signal } as never))
    .rejects.toMatchObject({ code: 'current-user-failed' })
})
```

- [ ] **Step 3: Run the new tests and confirm missing modules**

Run:

```bash
pnpm test -- src/features/auth/api/http-current-user-gateway.test.ts src/features/auth/current-user-query.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement validation and Query adaptation**

Keep the parser local to `http-current-user-gateway.ts`:

```ts
function readCurrentUser(value: unknown): CurrentUser | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'number' || !Number.isSafeInteger(record.id) || record.id < 0) return null
  if (record.username !== null && typeof record.username !== 'string') return null
  if (typeof record.email !== 'string' || record.email.trim() === '') return null
  if (record.avatar !== null && typeof record.avatar !== 'string') return null
  return {
    id: record.id as number,
    username: record.username as string | null,
    email: record.email,
    avatar: record.avatar as string | null,
  }
}
```

`currentUserQueryOptions` calls `gateway.get(signal)`, returns `result.data` on success, and throws `CurrentUserQueryError(result.code, result.message)` on failure. Set `retry: false`, `refetchOnWindowFocus: false`, and a stable query key.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
pnpm test -- src/features/auth/api/http-current-user-gateway.test.ts src/features/auth/current-user-query.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit CurrentUser integration boundaries**

```bash
git add src/features/auth/api/current-user-gateway.ts src/features/auth/api/http-current-user-gateway.ts src/features/auth/api/http-current-user-gateway.test.ts src/features/auth/current-user-query.ts src/features/auth/current-user-query.test.ts
git commit -m "feat: add current user query"
```

---

### Task 5: Bootstrap and recover the validated auth session

**Files:**
- Modify: `src/features/auth/model/auth-flow.ts`
- Modify: `src/features/auth/model/auth-flow.test.ts`
- Modify: `src/features/auth/auth-flow-provider.tsx`
- Modify: `src/features/auth/auth-flow-provider.test.tsx`
- Create: `src/features/auth/components/session-recovery.tsx`
- Create: `src/features/auth/components/session-recovery.test.tsx`

**Interfaces:**
- Consumes: observable `AuthSessionStore`, `CurrentUserGateway`, `currentUserQueryOptions`, and the nearest `QueryClientProvider`.
- Produces:

```ts
export type AuthSessionState =
  | { status: 'anonymous'; user: null; error: null }
  | { status: 'checking'; user: null; error: null }
  | { status: 'authenticated'; user: CurrentUser; error: null }
  | { status: 'recovery-error'; user: null; error: string }

interface AuthFlowValue {
  state: AuthFlowState
  session: AuthSessionState
  setEmail(value: string): void
  setPhone(value: string): void
  setCode(value: string): void
  requestCode(): Promise<boolean>
  resendCode(): Promise<boolean>
  verifyCode(): Promise<boolean>
  retrySession(): Promise<boolean>
  tickResendCountdown(): void
  backToContact(): void
  signOut(): void
}
```

- [ ] **Step 1: Remove unvalidated authentication from reducer tests**

Change reducer expectations so `submissionSucceeded` only clears submission state and never marks a token-present session authenticated. Remove `authenticated` from `AuthFlowState` and `createAuthFlowState`.

- [ ] **Step 2: Extend provider tests with Query/session fixtures**

Wrap the provider in a fresh Query client per test:

```tsx
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

root.render(
  <QueryClientProvider client={queryClient}>
    <AuthFlowProvider
      gateway={authGateway}
      currentUserGateway={currentUserGateway}
      sessionStore={sessionStore}
    >
      <AuthProbe />
    </AuthFlowProvider>
  </QueryClientProvider>,
)
```

Add cases for:

1. no tokens → `anonymous` without calling `/me`;
2. stored tokens → `checking`, then `authenticated` with user;
3. stored tokens + gateway failure → `recovery-error` while tokens remain;
4. OTP success saves tokens and keeps verification pending until CurrentUser succeeds;
5. CurrentUser failure after OTP returns `false`, keeps tokens, and `retrySession()` succeeds without a second OTP call;
6. `signOut()` clears tokens and removes `CURRENT_USER_QUERY_KEY` data;
7. the existing duplicate OTP/resend protections still call each gateway once.

- [ ] **Step 3: Run reducer/provider tests and confirm failure**

Run:

```bash
pnpm test -- src/features/auth/model/auth-flow.test.ts src/features/auth/auth-flow-provider.test.tsx
```

Expected: FAIL because validated session state and CurrentUser sequencing do not exist.

- [ ] **Step 4: Implement Query-driven session derivation**

Track the observable token snapshot in the provider and subscribe on mount. Call `useQuery` with the CurrentUser options and `enabled: tokens !== null`. Derive session exactly as follows:

```ts
const session: AuthSessionState =
  tokens === null
    ? { status: 'anonymous', user: null, error: null }
    : currentUserQuery.isSuccess
      ? { status: 'authenticated', user: currentUserQuery.data, error: null }
      : currentUserQuery.isError
        ? {
            status: 'recovery-error',
            user: null,
            error: 'Unable to restore session. Try again.',
          }
        : { status: 'checking', user: null, error: null }
```

In `verifyCode`, save valid tokens and then await `queryClient.fetchQuery(currentUserQueryOptions(currentUserGateway))` before dispatching submission success and returning `true`. On a CurrentUser failure, clear only the pending form submission, keep tokens, and return `false`. `retrySession()` calls `currentUserQuery.refetch()` and returns its success flag. `signOut()` clears the store, removes the current-user query, and resets the auth draft.

- [ ] **Step 5: Add recovery UI tests before component code**

Render `SessionRecovery` with explicit callbacks. Assert it renders `Unable to restore session. Try again.`, `Try again`, and `Sign out`; clicking retry calls only `onRetry`; clicking sign out calls only `onSignOut`; a pending retry disables both buttons and a second click cannot call `onRetry` again.

- [ ] **Step 6: Implement `SessionRecovery`**

Expose this focused component API:

```ts
interface SessionRecoveryProps {
  message: string
  onRetry(): Promise<boolean>
  onSignOut(): void
}
```

Use existing `FlowHeading`, `Button`, and `Loader`. Keep a local retry-pending boolean so repeated clicks are ignored and the retry button keeps stable dimensions. The root session gate owns when this component replaces route content.

- [ ] **Step 7: Run all auth tests**

Run:

```bash
pnpm test -- src/features/auth
```

Expected: PASS with no regression in OTP, email validation, resend countdown, loaders, or anti-spam behavior.

- [ ] **Step 8: Commit validated session behavior**

```bash
git add src/features/auth/model/auth-flow.ts src/features/auth/model/auth-flow.test.ts src/features/auth/auth-flow-provider.tsx src/features/auth/auth-flow-provider.test.tsx src/features/auth/components/session-recovery.tsx src/features/auth/components/session-recovery.test.tsx
git commit -m "feat: validate and recover auth sessions"
```

---

### Task 6: Add root guards and a layout-stable Home skeleton

**Files:**
- Create: `src/shared/ui/skeleton.tsx`
- Create: `src/features/home/home-session-skeleton.tsx`
- Create: `src/features/home/home-session-skeleton.test.tsx`
- Modify: `src/features/home/home-screen.tsx`
- Modify: `src/shared/api/app-env.ts`
- Modify: `src/shared/api/app-env.test.ts`
- Modify: `src/app/root-route.tsx`
- Modify: `src/app/root-route.test.tsx`
- Modify: `src/app/home-route.tsx`
- Modify: `src/app/home-route.test.tsx`
- Delete: `src/features/auth/api/mock-auth-gateway.ts`
- Delete: `src/features/auth/api/mock-auth-gateway.test.ts`

**Interfaces:**
- Consumes: `AuthFlowValue.session`, legacy/v1 clients, Query client, and router history.
- Produces:

```ts
export function Skeleton(props: React.ComponentProps<'div'>): ReactElement
export function HomeSessionSkeleton(): ReactElement
```

- [ ] **Step 1: Add skeleton and shared-geometry tests**

The primitive test asserts class merging preserves:

```tsx
<div aria-hidden="true" className="animate-pulse rounded-md bg-[#1c1c1c]" />
```

The Home test asserts the skeleton has the real outer frame classes:

```ts
expect(markup).toContain('flex min-w-0 flex-col gap-4 px-4 pt-6 pb-4')
expect(markup).toContain('aspect-[343/216]')
expect(markup).toContain('grid-cols-2 gap-x-2')
```

Add stable `data-layout-slot` attributes to both real and loading elements for `card`, `banner`, `stats`, `management`, and `getting-started`. The test compares the ordered slot names in server-rendered Home and skeleton markup.

- [ ] **Step 2: Implement the smallest shared geometry surface**

Export one feature-local `HomeContentFrame` from `home-screen.tsx`:

```tsx
export function HomeContentFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pt-6 pb-4">
      {children}
    </div>
  )
}
```

Use it in `HomeScreen` and `HomeSessionSkeleton`. Reuse `InfoBanner` for the skeleton banner, copy the exact stat-panel border/padding/grid classes, and use exact existing outer classes from `CardHero`, `CardManagementPanel`, and `GettingStartedSection`. Skeleton blocks replace content but never approximate the outer boxes.

- [ ] **Step 3: Extend root tests with pathname and redirect state**

Mock `useRouter` and `useRouterState` with a mutable pathname and a `replace` spy. Add cases:

- anonymous `/home` renders no Outlet and replaces with `/`;
- checking `/home` renders Home skeleton and does not render Outlet;
- checking `/` renders neither form Outlet nor Home skeleton;
- authenticated `/` replaces with `/onboarding`;
- authenticated `/home` renders Outlet;
- recovery error renders session recovery controls without redirect;
- PaymentPlansProvider is enabled only for `session.status === 'authenticated'`.

Mock `appEnv` in this unit test with `{ mode: 'test', apiBaseUrl: '/api' }`; this is explicit test configuration, not a runtime auth gateway.

- [ ] **Step 4: Run root and skeleton tests to confirm failure**

Run:

```bash
pnpm test -- src/features/home/home-session-skeleton.test.tsx src/app/root-route.test.tsx src/app/home-route.test.tsx
```

Expected: FAIL because the gate, Query composition, and skeleton do not exist.

- [ ] **Step 5: Require runtime API configuration**

Extend `REQUIRED_API_URL_MODES` in `app-env.ts` to include `development`. Update its test so missing development, staging, and production values throw `VITE_API_BASE_URL is required`, while `MODE: 'test'` remains usable for isolated modules. The checked-in `.env.development` already supplies `/api`.

- [ ] **Step 6: Compose clients and Query at the root**

Create one `QueryClient` with automatic Query and mutation retry disabled. Derive bases using `createApiBaseUrls(appEnv.apiBaseUrl)`, then create:

```ts
const legacyClient = createApiClient({
  baseUrl: bases.legacy,
  getAccessToken: () => browserAuthSessionStore.readTokens()?.access ?? null,
  onUnauthorized: () => browserAuthSessionStore.clear(),
})

const v1Client = createApiClient({
  baseUrl: bases.v1,
  getAccessToken: () => browserAuthSessionStore.readTokens()?.access ?? null,
  onUnauthorized: () => browserAuthSessionStore.clear(),
})
```

Build the OTP gateway from `legacyClient` and CurrentUser gateway from `v1Client`. Root composition rejects a null API base instead of selecting a mock. Delete `mockAuthGateway` and its dedicated test in the same task so no committed state has a missing root import. Wrap auth composition with `QueryClientProvider`. Continue composing `mockOnboardingGateway`, `mockVerificationGateway`, and `mockPaymentPlansGateway` unchanged.

- [ ] **Step 7: Implement the single root route gate**

Read the pathname from TanStack Router and derive redirect targets:

```ts
const redirectTo =
  session.status === 'authenticated' && pathname === '/'
    ? '/onboarding'
    : session.status === 'anonymous' && pathname !== '/'
      ? '/'
      : null
```

Perform history replacement in an effect. While `redirectTo` is non-null, render no route content. During `checking`, render `HomeSessionSkeleton` only for `/home`; render an empty shell for `/`. During `recovery-error`, render `SessionRecovery`. Otherwise render `Outlet`. Keep `PrivatePageShell` around protected/skeleton/recovery content and prevent flashes of inaccessible content.

- [ ] **Step 8: Update Home to validated session semantics**

Replace `authState.authenticated` checks with `session.status === 'authenticated'`. Logout continues to reset payment data, then calls the provider's `signOut`; the root gate performs the final route replacement.

- [ ] **Step 9: Run route, Home, auth, and environment tests**

Run:

```bash
pnpm test -- src/app src/features/home src/features/auth src/shared/api/app-env.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit guards and skeleton**

```bash
git add src/shared/ui/skeleton.tsx src/features/home/home-session-skeleton.tsx src/features/home/home-session-skeleton.test.tsx src/features/home/home-screen.tsx src/shared/api/app-env.ts src/shared/api/app-env.test.ts src/app/root-route.tsx src/app/root-route.test.tsx src/app/home-route.tsx src/app/home-route.test.tsx src/features/auth/api/mock-auth-gateway.ts src/features/auth/api/mock-auth-gateway.test.ts
git commit -m "feat: guard routes during session restore"
```

---

### Task 7: Verify retry timing, session UX, and mobile geometry

**Files:**
- Modify only files from Tasks 1–6 when verification exposes a requirement mismatch.

**Interfaces:**
- Consumes: the completed API/session bootstrap.
- Produces: verified behavior with no uncommitted corrective changes.

- [ ] **Step 1: Run the complete automated suite**

Run separately and record each exit status:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm build:staging
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Exercise the real local flow**

Run the frontend and backend using their existing local commands. In the browser:

1. clear `xplace.auth.access` and `xplace.auth.refresh`;
2. open `/home` and verify replacement to `/` without Home content flashing;
3. request email OTP and verify no duplicate requests occur while buttons are pending;
4. complete OTP and verify the Continue loader remains until `/users/me/` resolves;
5. reload `/home` and verify CurrentUser is fetched again from memory-empty Query cache;
6. return HTTP 401 for `/users/me/` and verify immediate logout with one request;
7. return HTTP 503 and verify backoff retries, then recovery controls;
8. click `Try again` and verify OTP is not submitted again.

- [ ] **Step 3: Compare loading and loaded layout at 320 and 375 px**

Use browser inspection to capture the bounding rectangles of `[data-layout-slot]` elements in both states. For `card`, `banner`, `stats`, `management`, and `getting-started`, assert identical `x`, `width`, and outer spacing; assert the first loaded frame does not produce visible vertical movement at scroll position 0.

- [ ] **Step 4: Review the final diff for scope and reuse**

Run:

```bash
git status --short
git diff --stat ef2e9d7..HEAD
git diff ef2e9d7..HEAD -- src/shared/api src/features/auth src/features/home src/app
```

Expected: changes trace only to the approved transport, session, guards, and skeleton work; no unrelated source or generated route-tree edits.

- [ ] **Step 5: Commit any verification-only corrections**

If Step 1–4 required code corrections, stage only those exact files and commit:

```bash
git commit -m "fix: complete session bootstrap verification"
```

If no corrections were required, do not create an empty commit.
