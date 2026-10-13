# Private Frontend

Minimal mobile-first frontend targeting PWA, built with Vite, React, TypeScript,
TanStack Router, and Tailwind CSS. 

## Development

Requirements: Node.js `^20.19.0 || ^22.13.0 || >=24` and pnpm 11.

```bash
pnpm install
pnpm dev
```

### Test on a phone over the local network

Connect the computer and phone to the same Wi-Fi network, then expose the Vite
development server to the local network:

```bash
pnpm dev --host 0.0.0.0
```

In development, requests under `/api` are proxied by Vite to the backend at
`http://localhost:8000`. This keeps the frontend usable from another device on
the same network: the phone talks to Vite on the computer, and Vite talks to the
local backend.

Vite prints a `Network` URL, for example:

```text
Network: http://192.168.0.41:5173/
```

Open that exact URL in the phone browser. The port may differ when `5173` is
already occupied, so use the address printed by Vite. If the page is not
reachable, check that VPN is disabled, the Wi-Fi network allows devices to see
each other, and the system firewall permits incoming connections for Node.js.

Press `Ctrl+C` in the terminal to stop the server.

Quality checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Partner favicon

Private selects its partner from the hostname and loads
`/api/v1/partner-branding/?partner=…`. Set `favicon_url` at the top level of
the partner's existing branding JSON, alongside `version` and the theme objects:

```json
"favicon_url": "/assets/partners/ww/favicon.svg"
```

The referenced file must be hosted at that path. Absolute HTTP(S) image URLs
also work when their origin is allowed by the site's `img-src` CSP. The icon
is applied and cached with the partner's theme. Missing, null, empty or invalid
values use the default `/favicon.svg`. This changes the browser tab icon;
PWA and Apple home-screen icons are separate.

Local development uses the mock theme by default. Add `?theme=backend` to load
the backend branding configuration.

## Crowdin OTA

The app initializes the Crowdin OTA JavaScript client when
`VITE_CROWDIN_DISTRIBUTION_HASH` is set. Copy `.env.example` to a mode-specific
local env file and add the public hash of a released Crowdin distribution. If
the variable is empty or absent, Crowdin remains disabled and the app starts
normally.

The English source and bundled Russian catalog live in
`src/shared/i18n/locales`. They cover the full app UI except agreement and
privacy-policy body text. The app bar selector persists the chosen locale.
Crowdin OTA translations are accepted only for keys present in the English
source catalog.

## Sentry

Deployed builds (`dev`, `staging`, `production`) automatically report browser,
unhandled promise and React errors to `xplace / x-place-private-client`.
The Sentry `environment` field identifies the build as `dev`, `staging` or
`production`. Current-user query data supplies `user.id` and, when available,
`user.email`; logout clears that identity. `users/me/` does not expose a phone
number. Default user-info collection remains disabled.
Local `pnpm dev` and tests do not send events. Distinct errors are captured;
TanStack page loads, navigation and request timings are sampled at 10%.
Existing error screens are preserved. API clients report failures once after
retries, with the request URL, method, status and JSON body. Successful and
cancelled requests are not reported. Request payloads preserve diagnostic data
while password, token, OTP, PIN and full card/security-code fields are redacted,
including nested JSON fields. Request headers, cookies and URL query/hash
values in errors and breadcrumbs are removed. Default user-info collection,
console breadcrumbs and Session Replay are disabled. Trace headers are not
added to API requests until backend CORS supports them.
Repeated identical errors are suppressed for the lifetime of the page, keeping
the last 100 distinct errors in memory. Error details and stack, request URL,
method, redacted JSON payload, response status and user ID distinguish events. Older
errors can be sent again after eviction; reloading the page resets this history.

For automatic source map uploads, add `SENTRY_AUTH_TOKEN` as a masked GitLab
CI variable with permission to upload releases to this Sentry project. werf
passes it through a build secret, and uses werf's Git commit hash as the Sentry release.
The Vite plugin uploads hidden source maps and deletes them before nginx's
image is assembled. Without a token, errors still work, but source maps are
not generated or uploaded. A configured upload failure fails the build.

For a local upload, supply `SENTRY_AUTH_TOKEN` and `SENTRY_RELEASE` as environment
variables when running `pnpm build`. Never prefix the token with `VITE_`, put
it into committed env files or pass it as a Docker build argument.

## Source structure

- `src/app` — application bootstrap and routes.
- `src/features` — product features, added when needed.
- `src/shared` — shared code, added when it has real consumers.

Routes live in `src/app/routes`. `src/app/routeTree.gen.ts` is generated and must
not be edited manually.

## Build and deployment

The app ships as a static bundle served by nginx. `Dockerfile` builds `dist/`
with pnpm on `node:24-slim` and copies it into `nginxinc/nginx-unprivileged`,
which listens on port `8080` as UID 101 with a read-only root filesystem.

nginx config lives in `nginx/`:

- `/healthz` answers Kubernetes probes.
- Hashed Vite bundles (`/assets/<name>-<hash>.js|css`) are served with
  `immutable` for a year; everything else under `/assets/` comes from `public/`
  without a content hash and must revalidate.
- `index.html` and `manifest.webmanifest` are served with `no-cache`, so a
  deploy reaches users without a purge.
- The Content-Security-Policy allows `connect-src` to the API origin of every
  deployed environment, the Crowdin OTA distribution host and Sentry ingestion.
  Widen it in `nginx/default.conf` when the app starts calling any other origin. External
  scripts are still blocked by `script-src 'self'`.

CI/CD is GitLab CI + werf 2 (`.gitlab-ci.yml`, `werf.yaml`, `.helm/`), matching
the backend and executor repositories:

| Stage    | Jobs                                     |
| -------- | ---------------------------------------- |
| `test`   | `typecheck`, `lint`, `test`, `helm:render` |
| `build`  | `werf build`                             |
| `deploy` | `deploy:development`, `deploy:stage`, `deploy:production` |

| Environment   | Branch      | Host                                       |
| ------------- | ----------- | ------------------------------------------ |
| `development` | default     | `private-frontend.dev.kube-main.x.place`   |
| `stage`       | `release/*` | `private-frontend.stage.kube-main.x.place` |
| `production`  | `production` | `wise-wolves.x.place`                      |

`development` and `stage` are served by the internal Envoy gateway behind an
internal load balancer, so they resolve to private addresses and are reachable
over VPN only. `production` runs in the `prod-eks` cluster and is published through its
external gateway, so it is reachable from the internet.
The `*.dev.kube-main.x.place` and `*.stage.kube-main.x.place` wildcards and their
certificate already exist, so another internal environment needs a values file and
a deploy job — no DNS or certificate work. A public host is different: it also needs
a DNS record, a listener pair on the external gateway and a certificate.

### Publishing a public host

`wise-wolves.x.place` is served by the external gateway of `prod-eks`, and its
certificate is issued by cert-manager. Because Cloudflare cannot reach an origin
that has no certificate yet, the record starts unproxied and is switched over
once the certificate exists:

1. Merge the listener pair into `k8s-cluster-production` and let ArgoCD sync it.
2. `terraform apply` in `16-cloudflare-dns` — the record is created with
   `proxied = false`.
3. Push to `production`; the deploy job verifies that both HTTPRoutes were
   accepted by the gateway.
4. `curl -sI http://wise-wolves.x.place/` — the redirect must point at
   `https://wise-wolves.x.place/` without a port.
5. Wait for `certificate/https-cert-wise-wolves-x-place` to become Ready.
6. Flip `proxied` to `true` and apply again; `dig +short wise-wolves.x.place`
   must then return Cloudflare addresses.

Never set the Cloudflare SSL mode to Flexible for this host: the origin redirects
plain HTTP to HTTPS, so Flexible turns every request into a redirect loop. If a
certificate ever expires and cannot be renewed, unproxy the record, let
cert-manager reissue, and proxy it again.

Vite inlines `VITE_*` into the bundle, so the API origin is fixed when the image
is built, not when it is deployed. The `build` job picks the mode from the
branch and passes it as the `BUILD_MODE` build arg; every deploy job repeats the
same value so werf resolves the image it built instead of rebuilding it.

| Vite mode     | API origin                              | Used by               |
| ------------- | --------------------------------------- | --------------------- |
| `development` | `/api` proxied to `localhost:8000`      | `pnpm dev`            |
| `dev`         | `https://backend.dev.kube-main.x.place` | `development` deploy  |
| `staging`     | `https://back-stage.x.place`            | `stage` and `production` deploys |
| `production`  | `https://back.x.place`                  | not deployed anywhere |
