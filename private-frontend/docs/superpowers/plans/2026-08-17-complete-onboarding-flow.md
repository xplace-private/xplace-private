# Complete Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Figma-matched onboarding steps 3–6 and move all six steps onto reusable layout and selection primitives.

**Architecture:** Keep the draft, validation, navigation, and gateway orchestration in the onboarding feature model/provider. Use one shared `OnboardingStepLayout` for the heading-to-actions rhythm and a typed `OnboardingSelectionStep` for single-choice screens; keep occupation search and agreements as focused compositions of the same layout. Submit one discriminated payload per step so the mock gateway can later be replaced without changing screen components.

**Tech Stack:** React 19, strict TypeScript, TanStack Router, Tailwind CSS v4, Vitest, pnpm 11.

## Global Constraints

- Preserve the `/onboarding` route and current app shell, fixed header, footer, and mobile document scrolling.
- Match the supplied Figma frames at 375 CSS pixels and remain usable at 320 CSS pixels.
- Use no new dependencies, invented API contracts, legal content, document URLs, or post-completion routes.
- Keep the existing warning copy `Select to continue` and warning color `#c98a7a`.
- Use 40px section padding, 32px heading-to-controls spacing, 10px option spacing, and 16px Continue-to-Back spacing on every step.
- Keep option-list nested scrolling limited to lists with more than five options.
- Do not add content-entry animation.

---

## File Structure

- Modify `src/features/onboarding/model/onboarding-flow.ts`: six-step draft, option constants, validation, and reducer navigation.
- Modify `src/features/onboarding/model/onboarding-flow.test.ts`: model regression coverage for all six steps.
- Modify `src/features/onboarding/api/onboarding-gateway.ts`: discriminated payload variants for steps 1–6.
- Modify `src/features/onboarding/api/mock-onboarding-gateway.ts`: validate every mock payload against the option constants.
- Modify `src/features/onboarding/api/mock-onboarding-gateway.test.ts`: successful and invalid calls for every payload variant.
- Modify `src/features/onboarding/onboarding-flow-provider.tsx`: typed setters, payload construction, sequential submit/back behavior.
- Modify `src/shared/ui/flow-heading.tsx`: allow steps without description copy.
- Create `src/features/onboarding/components/onboarding-step-layout.tsx`: shared heading, form rhythm, warning, Continue, and Back.
- Create `src/features/onboarding/components/onboarding-selection-step.tsx`: typed data-driven selection step.
- Modify `src/features/onboarding/components/residency-step.tsx`: compose the shared selection step.
- Modify `src/features/onboarding/components/occupation-step.tsx`: compose the shared layout around search and options.
- Create `src/features/onboarding/components/agreements-step.tsx`: agreement disclosures and acceptance selection.
- Modify `src/features/onboarding/onboarding-screen.tsx`: exhaustive rendering for steps 1–6.

---

### Task 1: Extend the onboarding domain model to six steps

**Files:**
- Modify: `src/features/onboarding/model/onboarding-flow.ts`
- Test: `src/features/onboarding/model/onboarding-flow.test.ts`

**Interfaces:**
- Produces: `OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6`.
- Produces: `YEARLY_INCOMES`, `MONTHLY_SPENDS`, and `ACCOUNT_PURPOSES` readonly option constants and their union types.
- Produces: six-field `OnboardingFlowState`, selection events, `validateOnboardingStep`, and sequential reducer navigation.

- [ ] **Step 1: Write failing model tests for every new selection and step**

Add literal expectations showing that steps 3–6 reject missing values, each setter clears only its own warning, successful submissions advance `2 → 3 → 4 → 5 → 6`, Back decrements without clearing values, and successful step 6 sets `completed: true` while remaining on step 6.

```ts
test.each([
  [3, { yearlyIncome: 'Select to continue' }],
  [4, { monthlySpend: 'Select to continue' }],
  [5, { accountPurpose: 'Select to continue' }],
  [6, { agreementsAccepted: 'Select to continue' }],
] as const)('requires the current step %s selection', (step, expected) => {
  expect(validateOnboardingStep({ ...createOnboardingFlowState(), step })).toEqual(expected)
})

test('completes the flow after a successful step 6 submission', () => {
  const state = onboardingFlowReducer(
    { ...createOnboardingFlowState(), step: 6, agreementsAccepted: true },
    { type: 'submissionSucceeded' },
  )
  expect(state).toMatchObject({ step: 6, completed: true, submission: 'idle' })
})
```

- [ ] **Step 2: Run the model test and verify RED**

Run: `pnpm test src/features/onboarding/model/onboarding-flow.test.ts`

Expected: FAIL because steps 3–6, their draft fields, and completion semantics do not exist.

- [ ] **Step 3: Implement the six-step state and reducer**

Use literal option constants from Figma:

```ts
export const YEARLY_INCOMES = [
  'Less than USD 25,000',
  'USD 25,000 – 50,000',
  'USD 50,000 – 100,000',
  'USD 100,000 – 180,000',
  'More than USD 180,000',
] as const

export const MONTHLY_SPENDS = [
  'Less than USD 1,000',
  'USD 1,000 – 5,000',
  'USD 5,000 – 25,000',
  'USD 25,000 – 50,000',
  'More than USD 50,000',
] as const

export const ACCOUNT_PURPOSES = [
  'Personal spending',
  'Business expenses',
  'Investments',
  'Something else',
] as const
```

Add nullable `yearlyIncome`, `monthlySpend`, and `accountPurpose`, boolean `agreementsAccepted`, and boolean `completed`. Replace the one-off `stepOneAccepted` event with `submissionSucceeded` advancing through an exhaustive `nextStep` switch. Include all selection events and `back` in pending-state blocking.

- [ ] **Step 4: Run the model tests and verify GREEN**

Run: `pnpm test src/features/onboarding/model/onboarding-flow.test.ts`

Expected: all onboarding model tests pass.

- [ ] **Step 5: Commit the model task**

```bash
git add src/features/onboarding/model/onboarding-flow.ts src/features/onboarding/model/onboarding-flow.test.ts
git commit -m "feat: extend onboarding model to six steps"
```

---

### Task 2: Extend the backend-ready gateway boundary and provider

**Files:**
- Modify: `src/features/onboarding/api/onboarding-gateway.ts`
- Modify: `src/features/onboarding/api/mock-onboarding-gateway.ts`
- Test: `src/features/onboarding/api/mock-onboarding-gateway.test.ts`
- Modify: `src/features/onboarding/onboarding-flow-provider.tsx`

**Interfaces:**
- Consumes: option union types and six-step reducer events from Task 1.
- Produces: `OnboardingStepPayload` with exact variants for steps 1–6.
- Produces: provider setters `setYearlyIncome`, `setMonthlySpend`, `setAccountPurpose`, and `acceptAgreements`.

- [ ] **Step 1: Write failing gateway tests for the four new payload variants**

```ts
test('accepts valid values for onboarding steps 3 through 6', async () => {
  await expect(mockOnboardingGateway.saveStep({ step: 3, yearlyIncome: 'USD 25,000 – 50,000' }))
    .resolves.toEqual({ ok: true })
  await expect(mockOnboardingGateway.saveStep({ step: 4, monthlySpend: 'USD 1,000 – 5,000' }))
    .resolves.toEqual({ ok: true })
  await expect(mockOnboardingGateway.saveStep({ step: 5, accountPurpose: 'Investments' }))
    .resolves.toEqual({ ok: true })
  await expect(mockOnboardingGateway.saveStep({ step: 6, agreementsAccepted: true }))
    .resolves.toEqual({ ok: true })
})
```

Add one invalid direct-call assertion per new variant using the field-specific codes `missing-yearly-income`, `missing-monthly-spend`, `missing-account-purpose`, and `missing-agreement-acceptance`.

- [ ] **Step 2: Run the gateway test and verify RED**

Run: `pnpm test src/features/onboarding/api/mock-onboarding-gateway.test.ts`

Expected: TypeScript/Vitest fails because payload variants and validators are missing.

- [ ] **Step 3: Add all gateway payloads and mock validation**

```ts
export type OnboardingStepPayload =
  | { step: 1; residency: Exclude<Residency, null> }
  | { step: 2; occupation: Occupation }
  | { step: 3; yearlyIncome: YearlyIncome }
  | { step: 4; monthlySpend: MonthlySpend }
  | { step: 5; accountPurpose: AccountPurpose }
  | { step: 6; agreementsAccepted: true }
```

Use exhaustive `switch (payload.step)` validation in the mock. Do not widen typed selections to arbitrary strings.

- [ ] **Step 4: Refactor provider payload construction and navigation**

Add one memoized dispatching setter per new field. Build the current payload with an exhaustive step switch after validation. Dispatch only `submissionSucceeded` after a successful save; the reducer now owns forward navigation and final completion. Implement `back()` as the generic decrement event.

- [ ] **Step 5: Run gateway, model, and type checks**

Run: `pnpm test src/features/onboarding/api/mock-onboarding-gateway.test.ts src/features/onboarding/model/onboarding-flow.test.ts`

Run: `pnpm typecheck`

Expected: both test files and strict TypeScript pass.

- [ ] **Step 6: Commit the gateway/provider task**

```bash
git add src/features/onboarding/api src/features/onboarding/onboarding-flow-provider.tsx
git commit -m "feat: submit all onboarding steps through gateway"
```

---

### Task 3: Create the reusable onboarding step primitives

**Files:**
- Modify: `src/shared/ui/flow-heading.tsx`
- Create: `src/features/onboarding/components/onboarding-step-layout.tsx`
- Create: `src/features/onboarding/components/onboarding-selection-step.tsx`
- Modify: `src/features/onboarding/components/residency-step.tsx`
- Modify: `src/features/onboarding/components/occupation-step.tsx`

**Interfaces:**
- Produces: `OnboardingStepLayout` with `eyebrow`, `title`, optional `description`, `error`, `pending`, `onContinue`, `onBack`, and `children` props.
- Produces: generic `OnboardingSelectionStep<T extends string>` with typed options, selected value, and selection callback.

- [ ] **Step 1: Create the common layout with the approved spacing contract**

The layout must render:

```tsx
<section className="flex min-w-0 flex-col gap-8 px-4 py-10">
  <FlowHeading eyebrow={eyebrow} title={title} description={description} />
  <form className="flex min-w-0 flex-col gap-2.5" onSubmit={submitHandler}>
    {children}
    {error && <p className="text-xs leading-[19.2px] font-light text-[#c98a7a]">{error}</p>}
    <div className="flex min-w-0 flex-col items-start gap-4">
      <Button variant="primary" type="submit" disabled={pending}>Continue</Button>
      <Button className={backButtonClasses} disabled={pending} onClick={onBack}>Back</Button>
    </div>
  </form>
</section>
```

Make `FlowHeading.description` optional so step 5 matches Figma without an empty paragraph.

- [ ] **Step 2: Create the typed selection composition**

`OnboardingSelectionStep<T>` maps `{ value: T; label: string }[]` into the existing `OptionList` and `OptionButton`, passes the shared warning state to every option, and delegates the rest to `OnboardingStepLayout`.

- [ ] **Step 3: Refactor residency and occupation onto the shared layout**

Residency delegates fully to `OnboardingSelectionStep`. Occupation retains only the search field and filtered list inside `OnboardingStepLayout`. Remove both local copies of `backButtonClasses`, action markup, warning markup, and section spacing.

- [ ] **Step 4: Run static checks and inspect the diff for duplication**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `rg -n "backButtonClasses|Select to continue" src/features/onboarding/components`

Expected: the action classes exist only in `onboarding-step-layout.tsx`; warning copy remains in the model, not duplicated in screen components.

- [ ] **Step 5: Commit the shared primitives task**

```bash
git add src/shared/ui/flow-heading.tsx src/features/onboarding/components
git commit -m "refactor: unify onboarding step layout"
```

---

### Task 4: Render Figma steps 3–5 through the shared selection component

**Files:**
- Modify: `src/features/onboarding/onboarding-screen.tsx`

**Interfaces:**
- Consumes: `OnboardingSelectionStep`, option constants, state values, and provider setters.
- Produces: exhaustive screen rendering for steps 1–5 before agreement composition is added.

- [ ] **Step 1: Add explicit selection-step cases to the screen switch**

Render these exact props:

```ts
const selectionCopy = {
  3: {
    eyebrow: 'APPLICATION · STEP 3 OF 6',
    title: 'What is your yearly income?',
    description: 'In US dollars, before tax.',
  },
  4: {
    eyebrow: 'APPLICATION · STEP 4 OF 6',
    title: 'What monthly spend do you expect?',
    description: 'A rough figure is fine. It does not set your limit.',
  },
  5: {
    eyebrow: 'APPLICATION · STEP 5 OF 6',
    title: 'What will you use the account for?',
  },
} as const
```

Map each option constant to `{ value, label: value }`. Use the matching state field, setter, error field, shared `continueStep`, and generic `back` handler.

- [ ] **Step 2: Verify the new screens compile and route sequentially**

Run: `pnpm typecheck`

Run: `pnpm test`

Expected: all tests and exhaustive TypeScript rendering pass.

- [ ] **Step 3: Commit the selection screens**

```bash
git add src/features/onboarding/onboarding-screen.tsx
git commit -m "feat: add financial onboarding steps"
```

---

### Task 5: Implement the agreement step and final completion

**Files:**
- Create: `src/features/onboarding/components/agreements-step.tsx`
- Modify: `src/features/onboarding/onboarding-screen.tsx`

**Interfaces:**
- Consumes: shared layout, `OptionButton`, agreement state, `acceptAgreements`, `continueStep`, and `back`.
- Produces: complete exhaustive rendering for all six onboarding steps.

- [ ] **Step 1: Implement the Figma-matched closed disclosures**

Render two `Button` elements with `aria-expanded={false}`, border `#1c1c1c`, `p-[18px]`, 13px light text, and a `+` in `#4a4a4a`. Labels are exactly `Cardholder Agreement (U.S. Customers)` and `Privacy Policy`. Keep them pressable but do not add content, URLs, or navigation.

- [ ] **Step 2: Add the acceptance option and shared actions**

Use `OptionButton` for `I have read and accept both agreements`, with the `agreementsAccepted` warning and selection state. Use the exact heading:

```tsx
<OnboardingStepLayout
  eyebrow="APPLICATION · STEP 6 OF 6"
  title="Before we verify you"
  description="Read and accept the agreements that apply to your account."
  error={state.errors.agreementsAccepted ?? state.gatewayError}
  pending={state.submission === 'pending'}
  onContinue={() => void continueStep()}
  onBack={back}
/>
```

- [ ] **Step 3: Render step 6 and verify completion behavior**

Add the final switch case in `OnboardingScreen`. Confirm Continue without acceptance warns, acceptance clears the warning, successful submission leaves `step === 6`, and `completed === true`.

- [ ] **Step 4: Run all automated checks**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm build`

Expected: zero test, type, lint, or build failures.

- [ ] **Step 5: Commit the agreement screen**

```bash
git add src/features/onboarding/components/agreements-step.tsx src/features/onboarding/onboarding-screen.tsx
git commit -m "feat: add onboarding agreement step"
```

---

### Task 6: Validate all six screens against Figma and mobile constraints

**Files:**
- Modify only files with an observed visual or interaction mismatch.

**Interfaces:**
- Consumes: completed six-step flow from Tasks 1–5.
- Produces: browser-verified 320px and 375px onboarding flow.

- [ ] **Step 1: Verify the complete flow at 375px**

Use the live `/onboarding` route. For each step, capture the title, option count, option labels, form spacing, warning state, selected state, Continue, and Back. Compare steps 3–6 side-by-side with Figma nodes `293:43617`, `293:43669`, `293:43857`, and `293:43721`.

- [ ] **Step 2: Verify the complete flow at 320px**

Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`, all option copy remains readable, no action is clipped, and the fixed app bar remains intact through the document scroll.

- [ ] **Step 3: Verify navigation and validation interactions**

For every step: press Continue empty, confirm the warning border/message, select a value, advance, press Back, and confirm the selection is preserved. On step 6, confirm agreement acceptance is required and completion makes no route change.

- [ ] **Step 4: Apply only evidence-backed parity fixes**

Adjust spacing, typography, or sizing only when the browser measurement differs from the Figma reference. Do not alter the shared shell or introduce page-specific fixed widths.

- [ ] **Step 5: Run final verification**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm build`

Run: `git diff --check`

Expected: all commands exit 0, browser flow completes, and no horizontal overflow exists at 320px or 375px.

- [ ] **Step 6: Commit final parity fixes**

```bash
git add src docs/superpowers/plans/2026-08-17-complete-onboarding-flow.md
git commit -m "fix: align complete onboarding flow with figma"
```
