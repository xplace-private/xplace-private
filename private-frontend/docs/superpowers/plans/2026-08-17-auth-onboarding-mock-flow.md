# Auth and Onboarding Mock Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two-step auth flow and the first two onboarding steps from the seven supplied Figma states, with typed mock gateways that can later be replaced by HTTP implementations.

**Architecture:** App-level feature providers keep auth and onboarding state alive across `/` and `/onboarding` until refresh. Each feature owns a pure reducer, validation, gateway contract, mock implementation, provider, and focused step components. The app layer only binds mock gateways and route callbacks; future HTTP gateways replace those bindings without changing screens.

**Tech Stack:** React 19, strict TypeScript, TanStack Router, Tailwind CSS v4, Vite 8, Vitest.

## Global Constraints

- Work on branch `setup` and preserve unrelated user changes.
- Routes are `/` for auth and `/onboarding` for the implemented questionnaire steps.
- State is in memory only and resets after page reload.
- Back preserves values during the current page lifetime, including returning from onboarding step 1 to the auth code screen.
- Any non-whitespace value is accepted by the mock; missing required values block progress and use warning color `#c98a7a`.
- Selected onboarding options use border `#c9bda8`; unselected options use `#1c1c1c`.
- Onboarding steps 3 through 6 are out of scope and must not be invented.
- Do not add content entrance animations.
- Add Vitest only as a development dependency; do not add a DOM emulator, Testing Library, form library, state library, icon library, or runtime dependency.
- Never edit `src/app/routeTree.gen.ts` manually.

---

## File Map

### Shared

- Create `src/shared/api/gateway-result.ts`: typed success/failure result used by both gateways.
- Create `src/shared/ui/private-page-shell.tsx`: shared fixed nav, safe-area layout, and legal footer composition.
- Create `src/shared/ui/flow-heading.tsx`: repeated eyebrow/title/description block.
- Move the current nav/footer rendering from `features/auth` into the shared shell without changing its appearance.
- Modify `src/shared/ui/button.tsx`: retain the existing primary button and use class overrides for the small bordered actions.

### Auth

- Create `src/features/auth/model/auth-flow.ts`: types, initial state, validation, and reducer.
- Create `src/features/auth/model/auth-flow.test.ts`: reducer and validation tests.
- Create `src/features/auth/api/auth-gateway.ts`: `AuthGateway` contract.
- Create `src/features/auth/api/mock-auth-gateway.ts`: asynchronous mock implementation.
- Create `src/features/auth/api/mock-auth-gateway.test.ts`: contract behavior tests.
- Create `src/features/auth/auth-flow-provider.tsx`: gateway orchestration and persistent in-memory state.
- Create `src/features/auth/components/phone-step.tsx`: phone screen and local warning state.
- Create `src/features/auth/components/code-step.tsx`: code empty/filled/local warning/gateway warning states.
- Modify `src/features/auth/auth-screen.tsx`: render the current auth step and emit successful authentication.
- Remove replaced auth-only layout components after the shared shell is wired.

### Onboarding

- Create `src/features/onboarding/model/onboarding-flow.ts`: types, occupations, filtering, validation, and reducer.
- Create `src/features/onboarding/model/onboarding-flow.test.ts`: reducer, filtering, and transition tests.
- Create `src/features/onboarding/api/onboarding-gateway.ts`: typed step-save contract.
- Create `src/features/onboarding/api/mock-onboarding-gateway.ts`: asynchronous mock implementation.
- Create `src/features/onboarding/api/mock-onboarding-gateway.test.ts`: step-save contract tests.
- Create `src/features/onboarding/onboarding-flow-provider.tsx`: orchestration and persistent draft.
- Create `src/features/onboarding/components/option-button.tsx`: selected, unselected, and warning option states.
- Create `src/features/onboarding/components/residency-step.tsx`: Figma step 1 and warning variant.
- Create `src/features/onboarding/components/occupation-step.tsx`: Figma step 2, search, selection, and warning.
- Create `src/features/onboarding/onboarding-screen.tsx`: choose step and handle Back.
- Create `src/app/routes/onboarding.tsx`: route composition only.

### App and assets

- Modify `src/app/root-route.tsx`: compose both providers with mock gateways around `Outlet`.
- Modify `src/app/routes/index.tsx`: navigate to `/onboarding` after mock code verification.
- Add `public/assets/onboarding/option-check.svg`: exact Figma check asset from node `264:28477`.
- Modify `package.json` and `pnpm-lock.yaml`: add stable Vitest and `pnpm test`.

---

### Task 1: Add the test runner and shared gateway result

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/shared/api/gateway-result.ts`

**Interfaces:**
- Produces: `GatewayResult = { ok: true } | { ok: false; code: string; message: string }`.

- [ ] **Step 1: Install the approved dev dependency**

Run:

```bash
pnpm add -D vitest
```

Expected: only `package.json` and `pnpm-lock.yaml` dependency metadata changes.

- [ ] **Step 2: Add the test command**

Add to `package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Add the shared result type**

Create:

```ts
export type GatewayResult =
  | { ok: true }
  | { ok: false; code: string; message: string }
```

- [ ] **Step 4: Verify project checks**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: TypeScript and ESLint pass. Run `pnpm test` after the first test is added in Task 2 because Vitest intentionally reports an empty suite before that point.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/api/gateway-result.ts
git commit -m "test: add Vitest for flow logic"
```

---

### Task 2: Build auth logic and mock gateway with TDD

**Files:**
- Create: `src/features/auth/model/auth-flow.test.ts`
- Create: `src/features/auth/model/auth-flow.ts`
- Create: `src/features/auth/api/mock-auth-gateway.test.ts`
- Create: `src/features/auth/api/auth-gateway.ts`
- Create: `src/features/auth/api/mock-auth-gateway.ts`

**Interfaces:**
- Produces: `AuthStep`, `AuthFlowState`, `AuthFlowEvent`, `createAuthFlowState()`, `authFlowReducer()`, `validateAuthStep()`.
- Produces: `AuthGateway.requestCode({ phone })` and `AuthGateway.verifyCode({ phone, code })` returning `Promise<GatewayResult>`.

- [ ] **Step 1: Write failing validation and reducer tests**

Cover these exact behaviors:

```ts
expect(validateAuthStep(createAuthFlowState())).toEqual({
  phone: 'Enter phone number to continue',
})

const withPhone = authFlowReducer(createAuthFlowState(), {
  type: 'phoneChanged',
  value: ' 554570290 ',
})
expect(validateAuthStep(withPhone)).toEqual({})
expect(authFlowReducer(withPhone, { type: 'phoneAccepted' }).step).toBe('code')

const withCodeError = authFlowReducer(
  { ...authFlowReducer(withPhone, { type: 'phoneAccepted' }), errors: { code: 'Enter code to continue' } },
  { type: 'codeChanged', value: '1' },
)
expect(withCodeError.errors.code).toBeUndefined()

const pending = authFlowReducer(withCodeError, { type: 'submissionStarted' })
expect(authFlowReducer(pending, { type: 'submissionStarted' })).toBe(pending)
```

The state shape is:

```ts
export interface AuthFlowState {
  step: 'phone' | 'code'
  phone: string
  code: string
  errors: Partial<Record<'phone' | 'code', string>>
  gatewayError: string | null
  submission: 'idle' | 'pending'
  authenticated: boolean
}
```

- [ ] **Step 2: Run the model test and verify RED**

Run:

```bash
pnpm test -- src/features/auth/model/auth-flow.test.ts
```

Expected: FAIL because `auth-flow.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal auth model**

Implement the state and events:

```ts
export type AuthFlowEvent =
  | { type: 'phoneChanged'; value: string }
  | { type: 'codeChanged'; value: string }
  | { type: 'errorsShown'; errors: AuthFlowState['errors'] }
  | { type: 'phoneAccepted' }
  | { type: 'backToPhone' }
  | { type: 'submissionStarted' }
  | { type: 'submissionSucceeded' }
  | { type: 'submissionFailed'; message: string }
```

`phoneChanged` and `codeChanged` clear only their own field error and the gateway error. `submissionStarted` is idempotent while pending. `submissionSucceeded` returns to idle and marks authentication only on the code step.

- [ ] **Step 4: Run the model test and verify GREEN**

Run:

```bash
pnpm test -- src/features/auth/model/auth-flow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing mock gateway tests**

Test real results:

```ts
await expect(mockAuthGateway.requestCode({ phone: '554570290' })).resolves.toEqual({ ok: true })
await expect(mockAuthGateway.verifyCode({ phone: '554570290', code: '1' })).resolves.toEqual({ ok: true })
await expect(mockAuthGateway.verifyCode({ phone: '554570290', code: '   ' })).resolves.toEqual({
  ok: false,
  code: 'missing-code',
  message: 'Enter code to continue',
})
```

- [ ] **Step 6: Run the gateway test and verify RED**

Run:

```bash
pnpm test -- src/features/auth/api/mock-auth-gateway.test.ts
```

Expected: FAIL because the contract and mock do not exist.

- [ ] **Step 7: Implement the gateway contract and mock**

Use:

```ts
export interface AuthGateway {
  requestCode(input: { phone: string }): Promise<GatewayResult>
  verifyCode(input: { phone: string; code: string }): Promise<GatewayResult>
}
```

Return success through `Promise.resolve` for non-whitespace values and typed failures for missing direct inputs. Do not add delays or format validation.

- [ ] **Step 8: Verify all auth tests and commit**

Run:

```bash
pnpm test -- src/features/auth
pnpm typecheck
pnpm lint
```

Then:

```bash
git add src/features/auth/model src/features/auth/api
git commit -m "feat: add auth flow model and mock gateway"
```

---

### Task 3: Implement the shared shell and auth UI

**Files:**
- Create: `src/shared/ui/private-page-shell.tsx`
- Create: `src/shared/ui/flow-heading.tsx`
- Create: `src/features/auth/auth-flow-provider.tsx`
- Create: `src/features/auth/components/phone-step.tsx`
- Create: `src/features/auth/components/code-step.tsx`
- Modify: `src/features/auth/auth-screen.tsx`
- Modify: `src/app/root-route.tsx`
- Modify: `src/app/routes/index.tsx`
- Delete after migration: `src/features/auth/components/auth-nav-bar.tsx`
- Delete after migration: `src/features/auth/components/auth-footer.tsx`
- Delete after migration: `src/features/auth/components/auth-form.tsx`

**Interfaces:**
- Consumes: `AuthGateway`, `authFlowReducer`, `validateAuthStep`.
- Produces: `AuthFlowProvider`, `useAuthFlow()`, `AuthScreen({ onAuthenticated })`.

- [ ] **Step 1: Move the exact shared layout without visual changes**

`PrivatePageShell` must preserve:

```text
fixed header: top 0, height calc(66px + safe-area-inset-top), padding-top safe area
header background: rgba(0,0,0,.82), backdrop blur 7px, border #1c1c1c
mobile width: 100%; desktop >=480px: centered max-width 375px
content top padding: calc(66px + safe-area-inset-top)
footer border: #1c1c1c; existing Agreement/Privacy/legal copy
```

It accepts `children`. `FlowHeading` accepts `eyebrow`, `title`, and `description` and reproduces the current 10/32/15 px typography.

- [ ] **Step 2: Implement the provider orchestration**

The context exposes:

```ts
interface AuthFlowValue {
  state: AuthFlowState
  setPhone(value: string): void
  setCode(value: string): void
  requestCode(): Promise<boolean>
  verifyCode(): Promise<boolean>
  backToPhone(): void
}
```

Use a ref-based pending guard plus reducer submission state so rapid presses create one gateway call. Keep the gateway as a provider prop. Do not import TanStack Router into the feature provider.

- [ ] **Step 3: Implement the phone step from `264:28126`**

Requirements:

```text
eyebrow: XPLACE PRIVATE
title: Apply or sign in
description: Enter your mobile number and we send a six-digit code on WhatsApp.
country: UAE flag +971 and existing chevron asset
input: empty initially, type=tel, inputMode=tel, autocomplete=tel, 16px+ mobile font safety
missing helper: Enter phone number to continue in #c98a7a
Continue: shared primary button
```

- [ ] **Step 4: Implement the code step from `264:28146`, `264:28166`, and `264:28186`**

Requirements:

```text
title: Enter your code
description includes the current +971 phone value
label: SIX-DIGIT CODE
input: type=text, inputMode=numeric, autocomplete=one-time-code, maxLength=6
visible letter spacing: 12px; placeholder 000000 at white 14%
missing helper: Enter code to continue
gateway rejection helper: gateway message; future incorrect-code copy uses the Figma #c98a7a treatment
secondary actions: RESEND IN 0:59 (visual only) and USE A DIFFERENT NUMBER (backToPhone)
```

- [ ] **Step 5: Wire route composition**

In `RootRoute`, bind `mockAuthGateway` to `AuthFlowProvider` around `Outlet`. In `/`, pass an `onAuthenticated` callback that navigates to `/onboarding`. The feature screen calls the callback only after `verifyCode()` resolves `true`.

- [ ] **Step 6: Verify auth interactively and commit**

Run tests and checks, then in the local browser verify phone empty warning, phone value preservation, code empty warning, any non-empty code navigation callback, and no horizontal scroll at 320 px.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git add src/shared/ui src/features/auth src/app/root-route.tsx src/app/routes/index.tsx
git commit -m "feat: implement mock authentication flow"
```

---

### Task 4: Build onboarding logic and mock gateway with TDD

**Files:**
- Create: `src/features/onboarding/model/onboarding-flow.test.ts`
- Create: `src/features/onboarding/model/onboarding-flow.ts`
- Create: `src/features/onboarding/api/mock-onboarding-gateway.test.ts`
- Create: `src/features/onboarding/api/onboarding-gateway.ts`
- Create: `src/features/onboarding/api/mock-onboarding-gateway.ts`

**Interfaces:**
- Produces: `Residency`, `OnboardingStep`, `OnboardingFlowState`, `OnboardingFlowEvent`, `OCCUPATIONS`, `filterOccupations()`, `validateOnboardingStep()`, `onboardingFlowReducer()`.
- Produces: `OnboardingGateway.saveStep(payload)`.

- [ ] **Step 1: Write failing model tests**

The state shape is:

```ts
export interface OnboardingFlowState {
  step: 1 | 2
  residency: 'united-states' | 'rest-of-world' | null
  occupation: string | null
  occupationQuery: string
  errors: Partial<Record<'residency' | 'occupation', string>>
  gatewayError: string | null
  submission: 'idle' | 'pending'
  implementedEndReached: boolean
}
```

Test: step 1 without residency returns `Select to continue`; choosing a residency clears the warning; accepting step 1 moves to step 2; Back restores step 1 without clearing residency or occupation; query filtering is case-insensitive; step 2 without occupation returns `Select to continue`; choosing an occupation clears the warning; successful step 2 save sets `implementedEndReached` without advancing beyond step 2; duplicate `submissionStarted` is idempotent.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm test -- src/features/onboarding/model/onboarding-flow.test.ts
```

Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement the minimal onboarding model**

Use exactly these visible occupations:

```ts
export const OCCUPATIONS = [
  'Accountant',
  'Actuary',
  'Advertising executive',
  'Aerospace engineer',
  'Agricultural manager',
] as const
```

Filtering affects visible options only and never changes the selected occupation.

- [ ] **Step 4: Run and verify GREEN**

```bash
pnpm test -- src/features/onboarding/model/onboarding-flow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing gateway tests**

Use the discriminated payload:

```ts
export type OnboardingStepPayload =
  | { step: 1; residency: Exclude<Residency, null> }
  | { step: 2; occupation: string }
```

Assert success for valid values and typed `missing-residency` / `missing-occupation` failures for direct invalid calls.

- [ ] **Step 6: Implement and verify the gateway**

```ts
export interface OnboardingGateway {
  saveStep(payload: OnboardingStepPayload): Promise<GatewayResult>
}
```

Return asynchronous immediate results without network calls or delays.

Run:

```bash
pnpm test -- src/features/onboarding
pnpm typecheck
pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git add src/features/onboarding/model src/features/onboarding/api
git commit -m "feat: add onboarding flow model and mock gateway"
```

---

### Task 5: Implement onboarding UI and route

**Files:**
- Create: `public/assets/onboarding/option-check.svg`
- Create: `src/features/onboarding/onboarding-flow-provider.tsx`
- Create: `src/features/onboarding/components/option-button.tsx`
- Create: `src/features/onboarding/components/residency-step.tsx`
- Create: `src/features/onboarding/components/occupation-step.tsx`
- Create: `src/features/onboarding/onboarding-screen.tsx`
- Create: `src/app/routes/onboarding.tsx`
- Modify: `src/app/root-route.tsx`

**Interfaces:**
- Consumes: `OnboardingGateway`, onboarding reducer/validation, shared shell/heading/button.
- Produces: `OnboardingFlowProvider`, `useOnboardingFlow()`, `OnboardingScreen({ onBackToAuth })`.

- [ ] **Step 1: Download the exact selection asset**

Download the Figma asset returned for node `264:28477`:

```bash
curl -L "https://www.figma.com/api/mcp/asset/7ce20d84-34c4-41f4-825a-f98f5ac90c2f.svg" -o public/assets/onboarding/option-check.svg
```

The destination is:

```text
public/assets/onboarding/option-check.svg
```

Verify it is valid SVG data; do not redraw it.

- [ ] **Step 2: Implement the provider**

Expose selection/search setters, `continueStep(): Promise<boolean>`, and `back()`. Bind the gateway through props. Step 1 success moves to step 2. Step 2 success sets `implementedEndReached` and stays on step 2. Pending presses are ignored by a ref guard.

- [ ] **Step 3: Implement the option primitive**

`OptionButton` props:

```ts
interface OptionButtonProps {
  selected: boolean
  warning: boolean
  children: ReactNode
  onClick(): void
}
```

Use 14 px light text, 18 px horizontal/16 px vertical padding, neutral `#1c1c1c`, selected `#c9bda8`, warning `#c98a7a`, and the 15 px exported check only when selected.

- [ ] **Step 4: Implement residency step states from `264:28477` and `264:28238`**

Copy:

```text
APPLICATION · STEP 1 OF 6
Where do you live?
Different agreements apply, and identity checks differ.
United States
Rest of the world
Select to continue
```

Continue validates/saves. Back calls `onBackToAuth`, returning to `/` while the auth provider retains the code screen and values.

- [ ] **Step 5: Implement occupation step from `264:28268`**

Copy:

```text
APPLICATION · STEP 2 OF 6
What is your occupation?
Search the list, or choose Other.
Search occupations
```

Render filtered visible occupations, selection treatment, Continue, Back, and `Select to continue` warning. Search is a real input and an occupation must still be selected.

- [ ] **Step 6: Wire app composition and route**

Wrap `Outlet` in `OnboardingFlowProvider` with `mockOnboardingGateway`. Add `/onboarding` route that renders `OnboardingScreen` and passes a callback to navigate to `/` from onboarding step 1. Do not add route guards yet.

- [ ] **Step 7: Run checks and commit**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
git add public/assets/onboarding src/features/onboarding src/app/root-route.tsx src/app/routes/onboarding.tsx src/app/routeTree.gen.ts
git commit -m "feat: implement first onboarding steps"
```

The route tree is generated by the TanStack plugin during checks; inspect it but never hand-edit it.

---

### Task 6: Visual and flow verification

**Files:**
- Modify only files whose rendered output demonstrably differs from Figma.

- [ ] **Step 1: Verify the seven Figma states at 375 px**

Compare:

```text
264:28126 phone
264:28146 code empty
264:28166 code filled
264:28186 code warning treatment
264:28477 residency selected
264:28238 residency warning
264:28268 occupation list
```

Exclude the fake iOS status bar and Safari browser chrome from application markup; account for the real device safe area instead.

- [ ] **Step 2: Verify responsive behavior**

At 320, 375, 390, and desktop widths confirm no horizontal overflow, the mobile column fills real phones, desktop is centered at 375 px, and the fixed header including safe area remains aligned during scroll.

- [ ] **Step 3: Verify the complete interaction flow**

Confirm:

```text
empty phone -> warning
phone -> code
empty code -> warning
non-empty code -> /onboarding
empty residency -> warning
residency -> occupation
occupation search filters
empty occupation -> warning
occupation selection -> implemented end remains on step 2
Back preserves values
reload resets both providers
rapid Continue does not duplicate gateway calls
```

- [ ] **Step 4: Run final verification**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected: all commands pass, console has no errors/warnings, and only intentional changes remain.

- [ ] **Step 5: Commit any visual corrections**

```bash
git add src/features/auth src/features/onboarding src/shared/ui src/app/routes src/app/root-route.tsx public/assets/onboarding
git commit -m "fix: align mock flow with Figma"
```
