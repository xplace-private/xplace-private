# Router-Owned Session Gate Design

**Date:** 2026-08-25

## Goal

Move authentication and applicant route eligibility into the TanStack Router
lifecycle so a route is selected before its leaf component commits. A stored
session opened at `/` must render one continuous pending surface and then only
the durable destination. The email authentication screen must never paint
between session recovery and `Checking your identity`.

This change is frontend-only. It adds no dependencies and changes no backend
API contract.

## Existing Problem

The application currently splits one routing decision across several owners:

- leaf `beforeLoad` guards check only whether tokens exist;
- `AuthFlowProvider` validates the current user after React mounts;
- `VerificationFlowProvider` loads applicant state after authentication;
- `RootRoute` derives the durable destination during render;
- a React effect calls `history.replace` after commit.

The root renderer withholds most incorrect outlets, but the route has already
matched. The arrangement is timing-sensitive and the current component-level
test harness cannot prove that an incorrect leaf never paints in the real
router lifecycle.

## Ownership

TanStack Router owns route eligibility and redirects. TanStack Query continues
to own current-user and applicant server data. Feature providers continue to
own OTP draft/submission behavior, verification polling, Sumsub token state,
and current-tab verification latches.

The app layer adds only the lifecycle coordination needed to connect those
existing owners:

- one extracted runtime containing the existing `QueryClient`, stores,
  gateways, and API clients;
- one typed router context;
- one session-route resolver used by the root route lifecycle;
- one monotonically increasing session generation used to reject stale async
  route decisions.

There is no second application-wide copy of current-user or applicant data and
no new general-purpose state machine.

## Route Lifecycle

The root file route uses `createRootRouteWithContext` and an asynchronous
`beforeLoad`.

For a cold navigation:

1. Read a complete token snapshot and capture the current session generation.
2. If tokens are absent, allow `/` and redirect every protected location to
   `/` with replacement.
3. If tokens exist, resolve the current-user query through the shared
   `QueryClient`.
4. If an authenticated `401` clears the token store, redirect to `/` rather
   than presenting session recovery.
5. If current-user restoration fails while the same tokens remain present,
   return a typed recovery result for the existing `SessionRecovery` UI.
6. On current-user success, resolve applicant detail through the same shared
   query cache.
7. An initial applicant failure reaches the existing route error boundary. It
   is never interpreted as an absent applicant.
8. Pass the target pathname and successful applicant result to the existing
   applicant route policy.
9. Throw a Router redirect before the leaf component commits when the target
   is not the durable destination.
10. Before publishing any success or recovery result, verify that the token
    snapshot and session generation still match. A stale resolution is
    discarded and the router resolves the current generation instead.

The root pending component appears immediately during this work. It selects the
existing route-shaped surface:

- `/home` uses `HomeSessionSkeleton`;
- `/transactions` uses `TransactionsSessionSkeleton`;
- other locations use the existing account loader.

The pending surface covers both current-user and applicant resolution as one
continuous router transaction.

## No-Remount and Animation Continuity Contract

The implementation must not use a session-, token-, user-, or route-dependent
React `key` on `QueryClientProvider`, `AuthFlowProvider`,
`VerificationFlowProvider`, `OnboardingFlowProvider`, `PrivatePageShell`, or
the root pending surface.

The application owns one `QueryClient` instance for its full lifetime. Runtime
extraction must move that existing singleton without recreating it during
renders or navigation.

On a stored-session cold load, the root pending component mounts at most once,
remains mounted while both current-user and applicant work resolve, and
unmounts only when the final allowed page commits. A provider must not expose a
second bootstrap `loading` phase after the router has already hydrated its
query. In particular, `VerificationFlowProvider` must recognize root-resolved
applicant data, including an explicit `null`, as ready without requiring a
second mount fetch or `isFetchedAfterMount` transition.

Route-specific skeleton identity remains stable through both bootstrap
requests. The implementation must not replace an account loader with another
fresh account loader merely because the session advanced from current-user
loading to applicant loading.

## OTP Handoff

OTP completion is not treated like cold startup. The code screen is already
the correct committed UI and must remain mounted while post-OTP routing is
resolved.

Saving new tokens must not blindly force the root route into its pending
component. A token-store observer distinguishes token adoption from token
removal:

- token removal caused by sign-out or `401` invalidates route access
  immediately after query cancellation and removal;
- token adoption caused by OTP is completed through an explicit handoff.

The OTP handoff preserves this sequence:

1. keep the existing code submission pending;
2. save tokens;
3. resolve and cache current user;
4. resolve and cache applicant through an app-injected coordinator;
5. compute the durable destination with the shared route policy;
6. perform one Router replacement to that destination;
7. commit the final page without mounting the email step or a root bootstrap
   loader in between.

The auth feature emits authentication intent through an injected app boundary;
it does not import app routing. Failed current-user restoration keeps the
existing recovery behavior. Failed initial applicant resolution reaches the
existing safe error boundary and never submits OTP again.

## Logout, Unauthorized Responses, and Identity Changes

Sign-out and authenticated `401` retain the current centralized cleanup:

- clear auth and verification session storage;
- cancel and remove current-user, applicant, card, transaction, and Sumsub
  identity-sensitive queries as applicable;
- increment the session generation;
- invalidate Router route access;
- replace a protected location with `/` before an anonymous leaf commits.

Token replacement must not reuse an old identity's global cached current-user
or applicant result. Cleanup plus the generation/token-snapshot check is the
minimum required protection. Query keys may be scoped further if implementation
evidence shows cleanup alone cannot provide the invariant, but speculative key
changes are not part of the initial design.

## Applicant Changes After Bootstrap

Known applicant-changing flows explicitly refresh or invalidate the applicant
query before asking Router to reconcile access:

- successful onboarding submission;
- verification polling that reaches a durable routing state;
- any future applicant mutation added by the owning feature.

Background applicant refetch failure with cached data keeps the last successful
route eligibility and visible screen. Initial applicant failure without cached
data remains an error.

The existing live-verification exception remains intact: approval first
observed by a committed `/verification` polling session shows `Account pending`
for two seconds before replacing with `/home`. Approval already present during
cold bootstrap routes directly to `/home`.

## Expected File Changes

New app-owned files:

- `src/app/app-runtime.ts` — existing singleton runtime composition;
- `src/app/router-context.ts` — typed router context and route-access result;
- `src/app/route-session-resolver.ts` — root lifecycle resolution and stale
  generation rejection;
- focused tests for the resolver and real router lifecycle.

Modified files:

- `src/app/routes/__root.tsx` — root context, `beforeLoad`, pending component;
- `src/app/router.ts` — provide the extracted runtime context;
- `src/app/root-route.tsx` — provider composition and recovery rendering only;
  remove effect-driven durable-route redirects and duplicate loading gates;
- `src/features/auth/auth-flow-provider.tsx` — app-injected successful OTP
  handoff while retaining feature-owned draft/submission behavior;
- `src/features/verification/verification-flow-provider.tsx` — consume
  root-resolved applicant cache without a second loading/remount cycle;
- `src/app/routes/onboarding.tsx` and verification completion coordination —
  refresh durable applicant state before route reconciliation;
- protected route files — remove token-only leaf guards only after root-router
  tests prove equivalent or stronger behavior;
- existing root, auth, verification, and route tests.

`src/app/routeTree.gen.ts` remains generated and is never edited manually.

## Error Semantics

- no tokens: anonymous route decision;
- authenticated `401`: clear session and redirect `/`;
- current-user failure with unchanged stored tokens: existing recovery UI with
  retry and sign-out;
- initial applicant failure without cached data: existing route error boundary;
- applicant background failure with cached data: retain current page and data;
- stale async result from an earlier generation: ignore and resolve the current
  generation;
- OTP failure before tokens: remain on the code screen with the existing safe
  auth error;
- post-OTP bootstrap failure: never fall back to the email screen or resubmit
  OTP automatically.

Raw external errors remain hidden from users.

## Testing

Automated tests must use a real TanStack memory-router lifecycle where paint or
mount ordering matters. Direct mocked `RootRoute` rendering may remain for pure
composition cases but is insufficient as no-flash evidence.

Required regressions:

- delayed current-user plus delayed applicant on `/` with stored tokens mounts
  the account loader once, never mounts `AuthScreen`, and unmounts the loader
  once when `Checking your identity` commits;
- the loader component instance and animation are not reset between the two
  requests;
- root-resolved cached applicant data, including `null`, does not trigger a
  second provider-level bootstrap loader or duplicate request;
- direct protected routes with no tokens redirect before protected outlets
  mount;
- each applicant state resolves to onboarding, verification, Sumsub, or home
  through the existing policy before an incorrect leaf mounts;
- current-user recovery failure renders `SessionRecovery`, while `401` renders
  anonymous auth only after the redirect resolves;
- a late current-user or applicant response from an earlier generation cannot
  publish route access after sign-out or token replacement;
- OTP keeps one continuous code-screen instance from submission through final
  route replacement, with no root loader or email-step mount;
- logout and `401` remove protected content and reconcile to `/`;
- onboarding refresh and verification polling reconcile route access without
  duplicate applicant requests;
- the existing two-second live approval presentation and polling-after-
  background-error tests remain green.

Implementation verification runs the focused tests first, then the full test
suite, TypeScript typecheck, ESLint, production build, `git diff --check`, and a
real-browser throttled cold-load/OTP visual check at mobile width.

## Success Criteria

- A stored authenticated session opened at `/` shows one uninterrupted loader
  or skeleton followed by only the durable destination.
- The email authentication screen never paints during stored-session recovery.
- OTP completion keeps the code screen mounted until one final route replace.
- No session-dependent React `key` remounts the provider tree or resets loading
  animation.
- Route eligibility has one authority: the root Router lifecycle plus the pure
  applicant policy.
- TanStack Query remains the sole owner of current-user and applicant server
  data.
- Logout, `401`, recovery, onboarding, verification polling, and the live
  two-second approval transition preserve their existing product behavior.
