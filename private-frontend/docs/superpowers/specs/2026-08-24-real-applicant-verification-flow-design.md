# Real Applicant and Verification Flow

## Goal

Replace the frontend onboarding and verification mocks with the existing applicant and Sumsub APIs. An authenticated user must be routed from durable applicant state, complete the local onboarding form once when needed, launch Sumsub WebSDK on its own internal route, and remain on the verification status screen until Rain reaches a terminal state.

This change is frontend-only. The backend API, webhooks, models, and serializers are used as they exist and are not modified.

## Scope

The implementation includes:

- authenticated application routing based on the existing applicant detail response;
- one real applicant submission after the final onboarding step;
- the existing real occupation search on onboarding step 2;
- a Figma-matched verification introduction screen;
- Sumsub WebSDK 2.0 rendered inline on `/verification/sumsub`;
- verification status polling every three seconds while the page is active;
- the Figma under-review, verified, and rejected states;
- removal of the onboarding and verification mocks from application composition;
- installation of the approved `@sumsub/websdk-react` runtime dependency.

The implementation does not include:

- any backend change;
- generation of an external Sumsub permalink;
- opening Sumsub in another tab or window;
- submission or persistence of agreements;
- persistence of the onboarding draft;
- display of raw backend, Sumsub, or Rain error details;
- display of `reject_comment`;
- new Rain remediation behavior for `needsInformation` or `needsVerification`.

## Existing API Contracts

### Applicant detail

Use authenticated `GET /api/v1/cards/applicant/detail/` for both the initial application gate and verification polling. The response is an object containing `applicant`, `cards`, and `kyc_link`; this flow consumes and validates only the applicant fields it needs:

- `id`;
- `sumsub_id`;
- `status`;
- `rain_approved`;
- `rain_status`.

Supported Sumsub status values are:

- `not_started`;
- `pending`;
- `approved`;
- `temporary_rejected`;
- `rejected`.

Supported Rain status values are:

- `approved`;
- `pending`;
- `needsInformation`;
- `needsVerification`;
- `manualReview`;
- `denied`;
- `locked`;
- `canceled`.

A real HTTP 404 means the authenticated user has no applicant. Network errors, 408, 429, and 5xx responses are not interpreted as a missing applicant. They use the retry behavior already owned by `ApiClient`; an error that remains after that retry budget is exhausted reaches the existing unexpected-error boundary and never redirects the user to onboarding.

### Applicant submission

Use authenticated `POST /api/v2/cards/applicant/` exactly once, after onboarding step 6 passes local validation. The request body is:

```json
{
  "occupation": 123,
  "salary": "USD 50,000 – 100,000",
  "volume": "USD 1,000 – 5,000",
  "purpose": "personal"
}
```

The selected occupation ID is sent as `occupation`. The existing yearly-income label is sent unchanged as `salary`, and the existing monthly-spend label is sent unchanged as `volume`.

Account-purpose labels map as follows:

| Frontend label | API value |
| --- | --- |
| `Personal spending` | `personal` |
| `Business expenses` | `business` |
| `Investments` | `investments` |
| `Something else` | `other` |

Residency is used only by the local onboarding UI. It is not submitted or persisted because the backend later receives the verified country from Sumsub.

### Sumsub access token

Use authenticated `POST /api/v1/sumsub/access-token/`. Validate the response as an object with non-empty string fields `token` and `userId` before it reaches the SDK.

The token stays in memory. It is never placed in the URL, browser history, local storage, or session storage. When the SDK invokes its token-expiration callback, fetch a fresh token through the same endpoint and return the new token to the SDK.

## Application Architecture

The existing dependency direction remains `app -> features -> shared`.

- The onboarding feature owns the applicant-submission gateway and mapping from the completed onboarding draft to the V2 request.
- The verification feature owns applicant-detail parsing, the applicant query options, token retrieval, SDK event handling, verification-state derivation, and status views.
- The app layer creates the HTTP gateways, composes the providers and routes, invalidates applicant data after onboarding completion, and performs route navigation.
- No feature imports another feature. App-level composition is the only point that coordinates onboarding completion with applicant-query invalidation and navigation.

Applicant detail has one TanStack Query key and one validated domain representation. The authenticated application gate and `/verification` consume that same query instead of issuing unrelated requests or maintaining duplicate status state. This single query is owned by the verification feature; it is not placed in the domain-neutral `shared` directory.

## Authenticated Application Gate

After authentication succeeds, the root application gate resolves applicant detail before rendering an authenticated destination. While the request and its built-in retries are pending, the gate follows the current session-loading behavior: it reuses `HomeSessionSkeleton` for `/home` and otherwise keeps route content withheld inside the existing shell. It does not briefly render onboarding, verification, or home.

The durable routing table is:

| Applicant result | Destination |
| --- | --- |
| HTTP 404 | `/onboarding` |
| Applicant exists but `sumsub_id` is null or empty | `/onboarding` |
| `rain_approved === true` | `/home` |
| Applicant exists with `sumsub_id` and Rain is not approved | `/verification` |

This gate applies to authenticated private routes, so a user cannot bypass incomplete onboarding or verification by typing `/home` directly. `/verification/sumsub` is allowed only while the applicant is eligible to enter or re-enter Sumsub. Direct navigation to an inapplicable private route is replaced with the durable destination rather than added to browser history.

If Rain is already approved during application startup or a later full session bootstrap, navigation goes directly to `/home`. The two-second Account pending success presentation is reserved for approval observed during the live `/verification` polling session.

## Onboarding Flow

The six-step draft remains owned by the onboarding provider and remains memory-only. Reloading onboarding starts again at step 1.

Steps 1 through 5 validate locally and advance locally. They do not call the applicant POST endpoint. Occupation search remains the existing debounced backend GET and keeps its current loading, empty, error, and retry behavior.

Step 6 validates agreement acceptance locally, but does not submit agreements to the backend. It builds the complete applicant payload from steps 2 through 5 and calls the V2 applicant endpoint once. The submission button remains disabled against duplicate clicks while that request is pending.

On applicant submission failure:

- remain on step 6;
- display the current generic form error, never the raw response;
- do not automatically retry the POST;
- retry only when the user presses the submission button again.

On applicant submission success:

1. mark the local flow complete;
2. invalidate the single applicant query;
3. replace the current route with `/verification`;
4. let the verification introduction screen prefetch a Sumsub token in the background.

Navigation does not depend on token prefetch succeeding. A token error must not cause another applicant POST.

## Verification Routes

### `/verification`

This route owns the verification introduction and durable status presentation. It never embeds the SDK itself.

When Sumsub is `not_started` or `temporary_rejected`, Rain is not approved, no terminal rejection exists, and the current-tab submission latch is not set, render the Figma `Continue identity verification` screen from node `573:13792`.

The introduction begins token prefetch in the background. Pressing Continue behaves as follows:

- if a prefetched token is available in the in-memory cache, push `/verification/sumsub` immediately;
- if token retrieval is still pending, show button loading and navigate after success;
- if token retrieval failed, keep the introduction visible with a short generic error and make the button retry only the token request.

Because navigation to the SDK route is a normal history push, browser Back from the SDK returns to `/verification`.

### `/verification/sumsub`

This protected internal route renders Sumsub WebSDK 2.0 inline inside the existing `PrivatePageShell`. The normal XPlace header and footer remain. The SDK container is shrinkable, bounded by the viewport, has no fixed minimum width, and lets the SDK adapt its iframe height. The phone status bar and Safari toolbar shown around the Figma frames are not product UI and are not implemented.

The route reads the access token from the in-memory verification query cache or retrieves one from the existing token endpoint. It does not expose the token in route params or search params.

Leaving with browser Back before document submission returns to `/verification`. Because no submission event was recorded, `not_started` and `temporary_rejected` still render the Continue screen.

The SDK event names come directly from Sumsub's `idCheck` WebSDK message namespace. Treat both of these events identically:

- `idCheck.onApplicantSubmitted` for the initial document submission;
- `idCheck.onApplicantResubmitted` for document resubmission after a retryable rejection.

On either event:

1. set the current-tab submission latch;
2. remove the consumed token from the in-memory cache;
3. replace `/verification/sumsub` with `/verification`;
4. render Checking your identity immediately;
5. start or resume applicant polling.

Use route replacement after submission so browser Back cannot return the user to the completed SDK screen.

If SDK initialization or runtime fails, return to the Continue screen with `Something went wrong. Please try again.` and let the Continue button start a new token/SDK attempt. Do not show the raw SDK error.

## Submission Latch

The SDK event is a fast UX signal; applicant detail remains the durable source of truth. A webhook and the subsequent applicant-detail reconciliation can lag behind the SDK event, so a just-submitted user must not regress from Checking your identity to Continue merely because an immediate GET still reports `not_started` or the previous `temporary_rejected` value.

Store a boolean submission latch in `sessionStorage`, scoped to the current browser tab. It contains no token or applicant PII. It is set before replacing the SDK route and is consulted only by `/verification`.

While the latch is set, stale `not_started` or `temporary_rejected` responses map to Under review. Clear the latch when applicant detail supplies durable forward progress (`pending`, `approved`, or `rejected`) or when Rain reaches an approved or terminal rejected state. A normal SDK exit before submission never sets the latch.

## Verification State Derivation

Rain approval controls successful completion. Sumsub approval by itself never renders Verified.

Apply state precedence in this order:

1. If `rain_approved === true`, the state is `verified` regardless of the current Sumsub status.
2. If Sumsub status is `rejected`, or Rain status is `denied`, `locked`, or `canceled`, the state is `rejected`.
3. If the current-tab submission latch is set, the state is `under-review` even if applicant detail has not advanced yet.
4. If Sumsub status is `not_started` or `temporary_rejected`, the state is `continue`.
5. If Sumsub status is `pending` or `approved` while Rain is not approved, the state is `under-review`.

Nonterminal Rain values `pending`, `needsInformation`, `needsVerification`, and `manualReview` all remain Under review in this scope.

The visual states are:

- `continue`: Figma node `573:13792`, with the Continue identity verification action;
- `under-review`: Figma node `293:43926`, titled `Checking your identity`, with `Identity — Under review`;
- `verified`: Figma node `293:43968`, titled `Account pending`, with `Identity — Verified`;
- `rejected`: Figma node `293:44010`, titled `We could not open your account`, with the Figma explanation, `Identity — Rejected`, and `Application — Closed`; no backend reject comment is shown.

Under review and Verified retain the current Limit, Card, and Annual membership rows. Rejected follows node `293:44010` instead: it renders only `Identity — Rejected` and `Application — Closed`.

When the polling session observes `verified`, stop polling, show Account pending for two seconds, then replace the route with `/home`. When initial application bootstrap sees an already-approved applicant, skip this presentation and route directly to home.

Rejected is terminal for the current verification screen: stop polling and remain on the rejected view.

## Polling Lifecycle

Use the shared applicant-detail query with a three-second refetch interval only while `/verification` is mounted, the state is nonterminal, and the document is visible.

- Start polling immediately after entering an under-review state.
- Do not poll while the Continue screen is idle.
- Pause polling while the browser tab is hidden.
- Refetch immediately when the tab becomes visible again.
- Stop polling on route unmount, Rain approval, or terminal rejection.
- Abort owned in-flight work when its route or observer is removed.

The SDK child route does not need applicant polling. After submission it replaces itself with the status route, which owns polling. If backend state has already advanced before the child route mounts, the route guard returns to `/verification` instead of launching an obsolete SDK session.

## Error Handling

- External responses are validated before domain or UI code consumes them.
- Applicant GET uses the existing safe-method retry policy. Only a real 404 means no applicant.
- Applicant POST is never retried automatically.
- Token POST is retried only by explicit user action or by the SDK expiration callback requesting a fresh token.
- Raw response bodies, Sumsub messages, Rain values, and stack details are never shown to the user.
- Token or SDK failure returns to the Continue state with `Something went wrong. Please try again.`
- Applicant POST failure remains on onboarding step 6 with the current generic form error.
- Unexpected render failures remain owned by route boundaries.

## Testing and Verification

Automated coverage must include:

- strict parsing of valid and invalid applicant-detail responses;
- strict parsing of valid and invalid Sumsub token responses;
- initial routing for applicant 404, missing `sumsub_id`, Rain pending, Rain terminal rejection, and Rain approval;
- proof that network and 5xx failures do not route to onboarding;
- local advancement without applicant POST on onboarding steps 1 through 5;
- the exact final applicant payload and all account-purpose mappings;
- final POST failure, manual retry, duplicate-click prevention, and success navigation;
- token prefetch, button retry, in-memory reuse, and expiration refresh;
- normal push navigation into `/verification/sumsub` and Back navigation to `/verification`;
- identical handling of `idCheck.onApplicantSubmitted` and `idCheck.onApplicantResubmitted`;
- SDK exit/error without a submission event;
- submission-latch prevention of stale-status regression and clearing on durable progress;
- the complete verification-state precedence table, including Sumsub approved with Rain not approved;
- three-second polling, hidden-tab pause, visible-tab immediate refetch, and terminal/unmount cleanup;
- Account pending for two seconds followed by a history replacement to `/home`;
- direct startup navigation to home without the two-second success screen;
- Figma Continue, Under review, Verified, and Rejected visual states.

Run and report:

- focused Vitest suites while developing;
- the full `pnpm test` suite;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm build`;
- `git diff --check`.

Perform browser comparison at a mobile viewport against Figma nodes `573:13792` and `293:43925`, including browser Back from the inline SDK route. Also verify on a real mobile browser or embedded WebView that the SDK remains within the viewport and camera/file interactions remain usable.

## Success Criteria

The feature is complete when an authenticated user is routed entirely from live applicant state, onboarding produces one correctly mapped applicant POST, Sumsub runs inline on `/verification/sumsub`, submit and resubmit events return immediately to the real polling screen, and only Rain approval produces the two-second Verified presentation before home. No mocks or backend modifications remain in this flow.
