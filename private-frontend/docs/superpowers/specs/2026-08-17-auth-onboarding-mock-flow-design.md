# Auth and Onboarding Mock Flow Design

## Goal

Implement the seven supplied Figma frames as four logical, mobile-first screens with their shown states: two authentication screens followed by the first two onboarding steps. The flow must cleanly separate authentication from onboarding and later switch from local mock responses to production HTTP APIs without rewriting screen components or navigation.

## Visual Sources

The Figma file key is `DGxkBFVzZRrJub2k8Slyhg`. Frames remain the source of truth for copy, fields, warning states, typography, spacing, colors, and assets. Multiple frames may represent different states of the same logical screen.

### Auth route: `/`

1. Phone-number screen: `264:28126`
2. WhatsApp-code screen, empty state: `264:28146`
3. WhatsApp-code screen, filled state: `264:28166`
4. WhatsApp-code screen, warning treatment: `264:28186`

### Onboarding route: `/onboarding`

1. Onboarding step 1, selected state: `264:28477`
2. Onboarding step 1, missing-selection warning: `264:28238`
3. Onboarding step 2, occupation list: `264:28268`

The Figma copy labels onboarding as a six-step application. Only steps 1 and 2 are in the current implementation scope; steps 3 through 6 are not invented.

## Route and Feature Boundaries

- `features/auth` owns the two authentication screens, authentication draft, local validation, auth transitions, and the `AuthGateway` interface.
- `features/onboarding` owns the first two questionnaire steps, onboarding draft, local validation, step transitions, and the `OnboardingGateway` interface.
- `app/routes` only composes features and maps them to `/` and `/onboarding`; route files contain no form or gateway behavior.
- `shared/ui` contains only domain-neutral controls that are used by both features. A component stays feature-owned when it has only one current consumer.
- The existing fixed XPlace navigation and safe-area behavior remain available to both routes when present in the Figma frame.

## State and Navigation

- Auth and onboarding use independent typed state controllers.
- State is held in React memory only. Refreshing the page resets the active flow.
- Back navigation within a flow preserves all values entered during the current page lifetime.
- Successful mock code verification navigates from `/` to `/onboarding` through TanStack Router.
- The onboarding controller begins at its first step when `/onboarding` is opened.
- The implemented onboarding steps remain on the single `/onboarding` route because they are one sequential questionnaire rather than independently addressable pages.

## Validation Behavior

- Every field marked as required by the Figma design must contain a non-whitespace value before its step can advance.
- Any non-empty value is accepted by the temporary mock flow; format and server-side validation are deferred until an API contract exists.
- Pressing Continue with missing required values keeps the user on the current step and applies the Figma warning color `#c98a7a` to the field border and helper text.
- Missing phone and code values use `Enter phone number to continue` and `Enter code to continue`. Missing country and occupation selections use the Figma copy `Select to continue`.
- The incorrect-code frame defines the future gateway rejection state and copy `Incorrect code. Enter valid code to continue`; the current mock accepts every non-empty code and therefore does not produce that rejection.
- A field's local warning is cleared as soon as the user provides a non-whitespace value.
- Validation is pure feature-owned logic, separate from React components and gateway implementations.
- Values are normalized only where the design requires it. Missing data is never replaced with invented defaults.

## Gateway Boundary

### Auth

`AuthGateway` exposes the minimum operations required by the two auth steps:

- request a WhatsApp verification code for the entered phone number;
- verify the entered code and return a successful authenticated result or a typed failure.

`MockAuthGateway` implements the interface asynchronously and accepts any non-empty values.

### Onboarding

`OnboardingGateway` exposes one operation that saves the typed data for the current onboarding step and returns success or a typed failure. It does not claim that step 2 completes the future six-step application.

`MockOnboardingGateway` implements the same interface asynchronously and returns success for locally valid data on steps 1 and 2.

Future HTTP gateway implementations replace only the feature composition binding. Screens, state controllers, validation, and routing continue to consume the same interfaces.

## Submission and Error States

- Continue is disabled while the current gateway request is pending, preventing duplicate submissions.
- Gateway failures are represented by typed feature results carrying a user-safe message rather than raw thrown messages reaching the UI.
- A gateway failure keeps the user on the current screen, preserves entered values, and renders its user-safe message with the warning treatment defined by the Figma frames. The mock gateways return success only.
- After onboarding step 2 saves successfully, the flow remains on step 2 because the next Figma step has not been supplied. No additional success page, persistence, account data, or invented product behavior is added.

## UI Composition

- The seven Figma frames are represented by four focused screen/step components and explicit visual states inside those components.
- Repeated step layout, field shells, warning treatments, progress/navigation controls, and primary actions reuse existing shared or feature-level components when their rendered design is identical.
- Selected options use the Figma accent border `#c9bda8` and the exact exported check asset. Unselected options use `#1c1c1c`.
- The shared primary button remains the canonical implementation and is extended only when a Figma state is not already supported.
- Exact icons and image assets are downloaded from Figma and committed under `public/assets` rather than recreated or sourced from icon packages.
- The implementation remains mobile-first, supports 320 CSS pixels, avoids document-level horizontal scrolling, uses dynamic viewport units, and preserves safe-area behavior.
- Content entrance animations are not added. Existing press feedback remains.

## Testing and Verification

- Add stable Vitest as a development dependency only. Do not add DOM emulators, Testing Library, form libraries, state libraries, or runtime dependencies.
- Write tests first for pure auth validation and auth transition behavior.
- Write tests first for onboarding validation, forward/back transitions, draft preservation, step saves, the implemented-end behavior after step 2, and duplicate-submit prevention.
- Gateway tests use the real mock implementations and assert returned typed results rather than mock call counts.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`.
- Visually compare every implemented screen state with all seven Figma screenshots at 375 CSS pixels.
- Verify the complete interactive flow at 320 and 375 CSS pixels and verify the centered mobile presentation on desktop.
- Verify the fixed navigation during scroll, empty-field warning states, Back value preservation, refresh reset, and route transition from `/` to `/onboarding`.

## Out of Scope

- Real API endpoints, authentication tokens, session persistence, protected-route enforcement, analytics, and production server error mapping.
- Deep links to individual questionnaire steps.
- Local or session storage.
- Production validation rules not present in the supplied Figma frames or an API contract.
- Onboarding steps 3 through 6 and any additional screens, fields, success states, or copy not present in the seven supplied frames.
