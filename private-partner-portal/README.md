# Private Partner Portal Frontend

Desktop-first, responsive frontend built with Vite, React, strict TypeScript,
TanStack Router, and Tailwind CSS. The architecture, dependencies, and tool
versions follow the Private frontend.

## Development

Requirements: Node.js `^20.19.0 || ^22.13.0 || >=24` and pnpm `11.19.0`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. `/` redirects to the current session's route.
The flow works without a backend:

- `/auth/sign-in` — sign in.
- `/auth/authenticator` — initial authenticator setup or repeat sign-in verification.
- `/auth/set-password` — permanent password setup.
- `/home` — authenticated partner dashboard.

Direct links to unavailable steps and unknown paths redirect to the current
session's route. All auth redirects replace the current history entry.

## Mock authentication

- Enter any valid email and a non-empty password to sign in.
- A new email starts authenticator setup. **Open in Authenticator App** follows
  an `otpauth://` link; the installed app and browser decide how to handle it.
  **Copy Authenticator Key** copies the key; if clipboard access fails, the key
  appears for manual copying. **Show QR code (for another device)** expands or
  collapses the QR for scanning with your phone. The QR is initially hidden.
- **Setup Later** skips initial authenticator setup and continues to password
  setup. On the next sign-in, unenrolled accounts are offered authenticator setup
  again; completing or skipping it returns to Home without repeating password
  setup. Accounts with 2FA enabled must verify a code and cannot skip 2FA.
- Enter the current six-digit code from that authenticator and press **Continue**.
  The mock uses SHA-1 TOTP with a 30-second period and accepts the current or
  adjacent time steps. Invalid codes show **Incorrect code**; a successfully used
  code cannot be reused. `123456` is no longer a fixed bypass.
- Enter matching passwords with at least 8 characters, an uppercase letter,
  a number, and a special character. For example: `Partner1!`.
- Completing initial setup opens `/home`. After **Log out**, the same email
  requires a fresh authenticator code and goes straight to Home. A different email
  gets a separate key and must complete authenticator and password setup.
  Email identity is trimmed and case-insensitive in this demo.
- **Forgot your password?** opens password recovery; the mock adapter reports it as unavailable.
- Session status, demo emails, enrollment state, TOTP keys and last-used time steps
  are kept in `sessionStorage`: reloading restores Home or the current unfinished
  step with the same key. Logout preserves each account's completed enrollment in
  the tab; clearing sessionStorage starts setup again. Passwords are never stored
  or checked against a saved password. Direct access to Home is gated by the router.
  Legacy v1 demo sessions have no account identity or TOTP key and start fresh.
- Invalid stored status starts a fresh sign-in. Storage failures surface as errors
  instead of claiming a successful login or logout. This client-editable mock
  status is not real authorization; production sessions belong to the HTTP adapter.

`src/features/auth/api/auth-gateway.ts` defines the feature contract.
Replace the mock binding in `src/app/app-runtime.ts` with an HTTP adapter when
the partner API is ready. The adapter owns response validation and server-side
session restoration; screens and route composition use the same contract.
The adapter also implements `getAuthenticatorSetup()` for the initial setup step,
returning a validated Base32 key, matching TOTP URI and `demo: false`. Production
keys, verification, replay protection and account enrollment belong to the server;
the local TOTP implementation is only used by the mock. No HTTP endpoint is assumed.
Successful actions must make the updated session available to `getSession()`.
Return safe display messages for expected failures; the `session` error code
also triggers a session refresh so expired or outdated steps leave the old screen.

## Password recovery

**Forgot your password?** opens `/auth/forgot-password`. The HTTP adapter posts
`{ email }` to `/partner/portal/v1/auth/password/forgot/` with CSRF and cookies.
Successful requests show the same **Check your email** screen whether the account
exists or not; the screen displays the submitted email and the delivery notice.

Email links open `/auth/reset-password?token=...` without requiring a session.
The form posts `{ token, password }` to `/partner/portal/v1/auth/password/reset/`.
Passwords must match and contain at least 12 characters; the backend also rejects
common, entirely numeric, and current passwords. Invalid or expired links keep
the user on the recovery screen with an error and **Back to Sign In**.
Tokens expire after 30 minutes and can be used once. A successful reset revokes
all sessions and returns to sign-in with a confirmation; the next login still
requires 2FA. Recovery is not simulated by the mock adapter.

## Mock Home

Home uses `HomeGateway` from `src/features/home/api/home-gateway.ts`, bound to
`mockHomeGateway` in `src/app/app-runtime.ts`. To connect the partner API, replace
that binding with a validated HTTP adapter implementing the read methods plus
`uploadAumConfirmation` and `submitPartnerReview`.
The adapter receives an `AbortSignal` and owns HTTP errors, session expiry and
response parsing. No endpoint or production response shape is assumed here.

- Overview and clients load independently with matching skeleton layouts.
- 47 deterministic clients support search, status filters and pages of 10, 20, 70,
  or 100 records.
  Status counts reflect the search before the selected status filter.
- Search waits 250 ms; mock requests take 450 ms and respect cancellation.
- Separate spend and commission charts use Recharts with shared shadcn components.
- **Open** for suspended, overdue, and Offboarding Pending clients shows payment
  details with **Copy** controls. Offboarding Pending also offers **Contact Team** in
  WhatsApp. **Open** for Partner Review lets a partner enter asset
  amounts, upload AUM confirmation, and confirm accuracy. Sending a valid review
  moves that client to Limit Review and refreshes the table and status counts.
  Active and Contact Support menu actions open partner support in WhatsApp; Limit Review,
  Onboarding, and Closed menus show their status details.
  Logout removes all Home queries and cancels reads.
- Empty results and independent request errors have clear states and retry/reset
  actions. Nullable amounts and contact fields remain unavailable, never zero.

KPI and chart values are illustrative Figma fixtures; client counts and pagination
are calculated from the records. `PartnerClient.paymentDetails` is nullable and
holds typed amounts, dates, transfer details, and a proof email. These are mock
values; the modal does not initiate a transfer or send an email. Partner Review
uploads are simulated and abortable. Submitted amounts and file metadata live only
in mock session memory; no file is sent to a server or persisted across reloads.
The mock is a UI adapter, not server authorization.

## Mock Profile

The company name in the Home header opens the authenticated `/profile` route.
Profile details come from a cancellable mock query and are cleared with other
private queries on logout. Company appears once in Account Information.
The 2FA switch opens the same authenticator form in a modal for unenrolled
accounts. Closing it keeps 2FA off; a valid code enables it without leaving
Profile or repeating password setup. The enabled state is restored on reload,
and accounts with 2FA enabled require a code at the next sign-in.
The switch animates between states and opens a confirmation before disabling
2FA. **Keep 2FA on**, Escape, or closing outside the modal leave it enabled.
**Turn off** applies the change; closing is blocked while it is pending. Disabling
preserves the authenticated session, verified setup key, and used-code protection.
Previously configured accounts can re-enable 2FA directly with the switch;
initial setup still requires a valid code. While 2FA is off, these accounts sign
in without a code. Storage failures leave the previous setting intact.
Change Password opens the designed form, while its
submit and Sign out all sessions display `WIP`; no password is changed or stored.

## API environments

The API servers and Vite modes match the Private frontend. Vite loads the
matching `.env.<mode>` file and exposes `import.meta.env.VITE_API_BASE_URL`.

| Mode | Env file | API server | Local launch | Build |
| --- | --- | --- | --- | --- |
| `development` | `.env.development` | `/api` through the proxy to `http://localhost:8000` | `pnpm dev` | — |
| `dev` | `.env.dev` | `https://backend.dev.kube-main.x.place` | `pnpm dev --mode dev` | `pnpm build:dev` |
| `staging` | `.env.staging` | `https://back-stage.x.place` | `pnpm dev --mode staging` | `pnpm build:staging` |
| `production` | `.env.production` | `https://back.x.place` | `pnpm dev --mode production` | `pnpm build` |

In `development`, the Vite proxy maps `/api/...` to `/api/v1/...` and keeps
`/api/v2/...` unchanged. Other modes use the configured API origin directly.

Use `.env.example` as a template for an optional `.env.<mode>.local` override,
then restart Vite. Local overrides are ignored by Git; the public environment
defaults are versioned. `VITE_*` values are included in the client bundle.
API-dependent features should read the base URL from the environment instead
of hardcoding a server address.

## Source structure

```text
src/
├── main.tsx          # React bootstrap
├── app/              # router, routes, composition, and global styles
│   └── routes/       # TanStack file routes
├── features/         # product features, added when needed
└── shared/           # shared UI and utilities
public/               # static assets
```

Dependencies flow `app -> features -> shared`. Features must not import other
features or `app`. Shared code imports neither `app` nor features. The `@` alias
points to `src`. Project rules live in `AGENTS.md`.

`src/app/routeTree.gen.ts` is generated by the TanStack Vite plugin and kept with
the source. Do not edit or lint it manually. Vite regenerates it when routes
change. The router enables automatic code splitting and scroll restoration.

Tailwind tokens, the Geist font, and shadcn settings follow the Private frontend.
The shared `Skeleton` defines loading placeholder styles.

## Shared foundation

- `src/shared/api` contains the environment reader, versioned API URL builder,
  HTTP client, typed request errors, and gateway result type. The client preserves
  unknown response data for feature-owned validation. CSRF and unauthorized
  handling are injectable; authentication is configured by the owning feature.
- `src/app/query-client.ts` and the root route provide a shared React Query client.
  Query-level retries are disabled, matching Private; the HTTP client owns its
  safe-request retry policy. Home reads data through feature-owned query options.
- `src/shared/ui` contains buttons, fields, modal shells and actions, dropdowns,
  loaders, notifications, icons, banners, headings, and content tiles. Modals use
  a desktop default width that callers can override, with bounded narrow layouts.
  `AppToaster` is mounted once at the root.
- `src/shared/i18n` contains shared English, Russian, French, and Spanish strings,
  language persistence, and a reusable `LanguageMenu`. The portal owns its
  language storage key and catalogs. Product pages and their translations are
  added with their features.
- Crowdin OTA is optional. Set the portal's own public
  `VITE_CROWDIN_DISTRIBUTION_HASH` in a local env override to enable it. Without
  that value, bundled translations work without external requests. Remote
  translations are validated against the portal's English source catalog.
- Stale JS chunk failures can trigger one automatic reload per tab, matching
  Private's recovery limit. Later failures or blocked browser storage keep the
  route error and manual refresh available.

The initial authentication flow uses mocks. Production authentication,
permissions, and client actions remain feature-specific work.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Focused Home checks: `pnpm test src/features/home`. These cover search and status
counts, pagination, empty and unavailable values, cancellation, query isolation,
adapter replacement, safe error states, and retry.

Focused auth checks: `pnpm test src/features/auth src/app/router.test.tsx`.
These cover injected session restoration, route replacement and Back/Forward,
failed and stale session reads, action failures and retries, duplicate requests,
mock step ordering, initial/repeat 2FA, cache isolation from stale session reads,
and password rules. Browser validation also needs a running app to check native form constraints, focus, and the complete UI flow.
Persistence checks recreate the gateway between steps and cover damaged data,
unavailable storage, failed writes, and concurrent gateway instances.

Real partner API contracts, cookies, CSRF, server session expiry, and TOTP require
integration checks when the HTTP adapter is implemented.

`pnpm preview` serves the production build locally after `pnpm build`.


## Sentry

Built `dev`, `staging`, and `production` versions report browser and React errors
into `xplace / x-place-private-partner`. The environment is the Vite build mode.
The local Vite development server does not send events; use `pnpm build:staging`
and `pnpm preview` to check the staging integration locally.

The active mock session supplies only its email, including after reload. Logout
clears the Sentry user. A real user ID must come from the partner API when it is
connected; profile fixture IDs are not used for error attribution.

Repeated errors are suppressed within a page lifetime, keeping the last 100
signatures. Different users or request payloads remain separate. Request JSON is
retained with passwords, tokens, TOTP secrets/codes and card credentials redacted;
unstructured bodies, cookies, headers and URL query strings are filtered.
Console breadcrumbs and session replay are disabled. Navigation tracing samples
10% of transactions and does not add tracing headers to backend requests.

The Vite plugin uploads hidden source maps to `x-place-private-partner` when
`SENTRY_AUTH_TOKEN` is present during a build, then removes `.map` files from
`dist`. Without a token the build succeeds without source maps. The token belongs
in a masked CI variable, never a `VITE_` variable or frontend source code.
The werf build uses the commit SHA as `SENTRY_RELEASE` and passes the optional
`SENTRY_AUTH_TOKEN` to Docker through the `sentry_auth_token` secret. The token is
available only to the frontend build command, not the final nginx image. Nginx
CSP allows connections to the project's Sentry ingest origin. Sentry upload
warnings in build logs need checking separately.

`pnpm-workspace.yaml` must be copied before `pnpm install` in Docker: it approves
the official `@sentry/cli` installation script required by the Vite plugin.
