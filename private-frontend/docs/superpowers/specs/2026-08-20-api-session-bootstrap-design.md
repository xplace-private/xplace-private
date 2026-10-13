# API Client and Session Bootstrap Design

**Date:** 2026-08-20

## Context

The application can request and verify email or phone OTP codes. Successful OTP
verification stores access and refresh tokens in `localStorage`, but token
presence is currently treated as authentication without validating the session
or loading the account. Routes are not guarded, and each HTTP gateway currently
uses `fetch` directly.

The next backend integration adds the authenticated current-user endpoint:

```http
GET /api/v1/users/me/
Authorization: Bearer <access_token>
```

```ts
interface CurrentUser {
  id: number
  username: string | null
  email: string
  avatar: string | null
}
```

The project is expected to add many backend-backed features, so transport,
retry, and server-state behavior must be reusable without moving domain parsing
or product rules into the shared layer.

## Goals

- Introduce a reusable HTTP transport based on Ky.
- Introduce reusable in-memory server-state management based on TanStack Query.
- Retry temporary failures with exponential backoff while allowing retry to be
  disabled per request.
- Never retry OTP sends, OTP verification, unauthorized responses, or aborted
  requests.
- Validate the stored token by loading the current user at application startup.
- Load the current user immediately after OTP verification and before leaving
  the authentication flow.
- Remove runtime auth mocks now that OTP and CurrentUser have backend contracts;
  missing API configuration must fail visibly instead of enabling fake login.
- Keep `CurrentUser` in memory and keep the temporary tokens in `localStorage`.
- Redirect authenticated and anonymous users away from routes they cannot use.
- Show route-shaped loading UI without a full-screen spinner or layout shift.

## Non-goals

- Refreshing an expired access token. The backend will replace the temporary
  authentication endpoints later.
- Persisting the current-user object to browser storage.
- Migrating mocked onboarding, payment-plan, or verification gateways to the
  backend. Those features keep their mocks until their backend contracts are
  connected.
- Creating a general-purpose generated SDK or adding response-schema libraries.
- Retrying non-idempotent mutations by default.

## Dependency decision

The implementation adds two runtime dependencies:

- `ky` owns HTTP transport concerns: URL resolution, JSON requests, Bearer
  headers, timeouts, retries, abort signals, and HTTP errors.
- `@tanstack/react-query` owns remote-data lifecycle concerns: in-memory cache,
  request deduplication, loading/error/success state, explicit refetch, and
  cache removal on logout.

Retry has one owner. Ky performs automatic transport retries; TanStack Query
automatic retries are disabled. This prevents compounded retry sequences such
as ten Query retries each containing ten Ky retries.

## Architecture

### Shared HTTP transport

`src/shared/api` will expose a small application-facing `ApiClient` interface
and a Ky-backed factory. Feature gateways depend on `ApiClient`, not directly on
Ky, so they remain easy to test and transport configuration stays centralized.

The client supports:

- relative endpoint paths;
- HTTP method, JSON body, headers, and `AbortSignal`;
- an `authenticated` option that attaches the current access token;
- a request-level `retry` boolean;
- an `unknown` JSON result that must be validated by the owning feature;
- typed transport errors containing the response status and untrusted response
  body when available.

The shared layer does not import authentication feature types. The factory
instead receives two callbacks:

- `getAccessToken(): string | null`;
- `onUnauthorized(): void`.

`onUnauthorized` runs only when an authenticated request returns `401`. It does
not run for public requests or `403` responses. Logout remains idempotent so
simultaneous unauthorized requests cannot corrupt state.

The auth-owned token store becomes observable and exposes `readTokens()` plus
`subscribe(listener)`. `saveTokens()` and `clear()` notify subscribers. The app
passes token-store callbacks to the shared client, while the auth provider
subscribes to token changes. Therefore a `401` handled below the React tree can
still update session state, clear the user cache, and trigger the route gate
without making the shared client depend on React or auth feature code.

### API base URLs

The existing environments expose different public shapes:

- local development calls `/api/...`; the Vite proxy rewrites that prefix to
  the local backend's `/api/v1/...`;
- the temporary staging OTP endpoints are currently exposed directly below the
  configured origin;
- the current-user contract is explicitly versioned as `/api/v1/users/me/`.

`VITE_API_BASE_URL` is required in development, staging, and production because
auth no longer has a runtime mock fallback. Test code supplies explicit fake
gateways and API configuration at its own composition boundary.

The transport factory is reusable across multiple base URLs. Application
composition creates:

- a legacy-auth client using the existing API base for the temporary OTP
  endpoints;
- a v1 client using `/api` locally and `<absolute-api-origin>/api/v1` in staging
  and production.

Both clients share the same transport implementation and retry policy. When the
temporary OTP endpoints are replaced, their gateway can switch to the v1 client
without another transport refactor.

### Retry policy

For retry-enabled, idempotent requests, Ky performs one initial request plus at
most ten retries.

Retries apply only to:

- network failures that are not aborts;
- `408 Request Timeout`;
- `429 Too Many Requests`;
- `5xx` responses.

The delay uses exponential backoff starting at 300 ms, capped at 10 seconds,
with jitter. A server-provided valid `Retry-After` value may be honored, subject
to the same request policy. `AbortError`, `400`, `401`, `403`, `404`, and other
non-temporary client failures stop immediately.

Safe read methods are retry-enabled by default. Mutating requests are not
retry-enabled by default and must opt in only when the endpoint is known to be
idempotent. The request option can explicitly set `retry: false`; all phone/email
OTP send calls and OTP verification use this setting even though they are also
mutations. This makes the non-retryable requirement visible at each sensitive
call site.

After Ky exhausts the retry budget, TanStack Query exposes the final error. The
UI offers an explicit `Try again`, which starts a new retry sequence, and
`Sign out`, which clears the local session.

### Feature gateways and response validation

The existing HTTP OTP gateway will be refactored to use `ApiClient`. Its public
`AuthGateway` contract and user-safe error messages remain unchanged. Domain
parsers for OTP responses, rate-limit responses, and auth tokens remain inside
the auth feature.

`mockAuthGateway` is removed from application source. Auth component tests use
test-local gateway fakes. Existing onboarding, verification, and payment-plan
mock gateways remain unchanged because those backend features are out of scope.

The auth feature adds a current-user gateway using the v1 client. It requests
`users/me/` with `authenticated: true` and validates every response field before
returning `CurrentUser`:

- `id` is a non-negative safe integer;
- `username` is a string or `null`;
- `email` is a non-empty string;
- `avatar` is a string or `null`.

Invalid success payloads become a user-safe gateway failure. Raw backend or
transport errors are never rendered directly.

To match existing project conventions, the current-user gateway returns a
`GatewayResult<CurrentUser>`. Its TanStack Query adapter converts a failed result
to one internal typed exception so Query can enter its error state; UI still
receives only the gateway's safe message and classification.

### Query client and current-user cache

Application composition owns one `QueryClient`. Feature code defines the
current-user query key and query function; the app provides the Query client at
the root.

The current-user query:

- uses a stable auth-specific query key;
- is enabled only when both tokens are present;
- stores `CurrentUser` only in the in-memory Query cache;
- disables TanStack Query retries because Ky owns retry;
- does not refetch on window focus during the same application session;
- naturally runs again after a browser reload because the cache is not
  persisted.

Logout clears both tokens and current-user query data. No user data is written
to `localStorage`.

## Session lifecycle

The session state distinguishes `checking`, `authenticated`, `anonymous`, and
`recovery-error`. Token presence alone never means authenticated.

### Application startup

1. Read access and refresh tokens from `localStorage`.
2. If either token is missing or invalid, enter `anonymous` immediately.
3. If both exist, enter `checking` and fetch the current user.
4. On success, cache the user in memory and enter `authenticated`.
5. On authenticated `401`, clear tokens and user data, enter `anonymous`, and
   redirect to `/` without retry.
6. On a temporary or malformed-response failure after all retries, preserve the
   tokens, enter `recovery-error`, and show `Try again` and `Sign out`.

### OTP completion

1. Keep the Continue button pending and protected from repeated clicks.
2. Verify OTP with retry disabled.
3. Save the returned access and refresh tokens.
4. Fetch and validate the current user through the Query client.
5. On success, cache the user, mark the session authenticated, and navigate to
   `/onboarding`.
6. On `401`, clear the newly stored tokens and return to anonymous auth.
7. On an exhausted temporary failure, keep the tokens and show session recovery
   controls. Retrying session recovery does not submit the OTP again.

### Logout

Logout clears tokens, removes current-user data and errors from the Query cache,
resets the auth draft, and replaces the current route with `/`.

## Route access and loading UI

One root-level session gate owns redirects so individual route files do not
duplicate auth checks.

- An authenticated user opening `/` is redirected with history replacement to
  `/onboarding`.
- An anonymous user opening `/onboarding`, `/verification`, `/home`, `/payment`,
  or `/transactions` is redirected with history replacement to `/`.
- An authenticated user opening a protected route remains on that route.
- Redirect decisions wait until session checking finishes, preventing auth-form
  or protected-content flashes.

When tokens exist and `/home` is loading the current user, the app renders a
Home-specific skeleton inside the real `PrivatePageShell`. It follows the
shadcn-style primitive (`animate-pulse`, rounded blocks, muted background) but
is implemented locally with existing Tailwind tokens.

The Home skeleton and real Home content reuse feature-local layout wrappers for
the outer spacing, card aspect ratio, banner, statistics grid, management
panel, and visible action tiles. This avoids copying approximate dimensions.
The initial geometry must match at 320 px and 375 px widths so replacing the
skeleton does not shift the page. On `/`, the existing black auth background is
retained while checking, but the auth form is withheld.

## Error handling

- `401` from an authenticated request: no retry, clear session, redirect to
  auth.
- `403`: no retry and no global logout; surface a feature-safe forbidden error.
- Temporary transport failure: Ky retries, then session recovery UI if all
  attempts fail.
- Invalid current-user JSON: no transport retry, preserve tokens, show recovery
  UI because the client cannot safely construct a user.
- OTP rate limit: keep the existing server duration handling and do not retry.
- Abort caused by unmount or request replacement: stop silently and do not show
  a stale failure.

## Testing and verification

Tests will cover:

- shared client URL composition for local, legacy, and v1 bases;
- Bearer attachment only for authenticated requests;
- one initial request plus ten retries for eligible failures;
- capped backoff, jitter, abort behavior, and retry-status classification;
- request-level retry disablement;
- immediate unauthorized callback with no retry;
- OTP gateway behavior after migration to `ApiClient`;
- strict current-user response validation;
- startup restoration, OTP-to-user sequencing, recovery retry, and logout;
- route redirects without protected/auth content flashes;
- skeleton structure and shared geometry classes;
- rendered layout comparison at 320 px and 375 px widths.

The final verification runs the full test suite, TypeScript typecheck, ESLint,
development and staging builds, and `git diff --check`. Browser inspection will
compare loading and loaded Home layouts at both target widths.

## Success criteria

- A valid stored session restores the current user and requested protected route.
- An expired session logs out immediately on `401` without retry.
- A temporary `/users/me/` failure retries at most ten times with backoff and can
  be retried manually afterward.
- OTP requests are never automatically repeated.
- Authenticated and anonymous users cannot render the wrong route content.
- Missing runtime API configuration cannot silently enable fake authentication.
- Current-user data is never persisted outside memory.
- Home session restoration has no measurable initial layout shift at 320 px or
  375 px.
- Existing email OTP, resend countdown, rate-limit messaging, and button
  anti-spam behavior remain intact.
