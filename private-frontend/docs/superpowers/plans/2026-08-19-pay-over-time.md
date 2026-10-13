# Pay over time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the complete mocked Pay over time flow across transaction details, Home payment plans, early settlement, and Pay Now while keeping the data boundary ready for a real API.

**Architecture:** A typed payment-plan domain model calculates quotes and eligibility from integer cents. An injected `PaymentPlansGateway` is orchestrated by a root-mounted provider, while Home, Transactions, and Payment routes adapt the shared state into feature-owned screen props. Existing modal, button, banner, transaction, section, toast, and QR components are reused.

**Tech Stack:** React 19, strict TypeScript, TanStack Router, Tailwind CSS v4, Vitest, Sonner.

**Spec:** `docs/superpowers/specs/2026-08-19-pay-over-time-design.md`

## Global Constraints

- State is in memory only and resets on reload and sign out.
- Eligibility requires USD, amount strictly over 100,000 cents, state `completed` or `pending`, and no active plan.
- Terms are exactly 3, 6, and 9 months at 1,800 APR basis points.
- Domain money uses integer cents; UI never parses formatted amount strings.
- Do not add a state, form, icon, or test dependency.
- Reuse `ModalShell`, `ModalActions`, `Button`, `InfoBanner`, `SectionHeader`, `SectionDivider`, transaction components, and Sonner.
- Keep layouts padding-driven, shrinkable, and usable at 320 and 375 CSS pixels.
- Download exact Figma SVG assets when no matching project asset exists; never hand-author replacement paths.

---

### Task 1: Transaction money and payment-plan domain

**Files:**
- Create: `src/features/home/model/transaction.ts`
- Create: `src/features/home/model/payment-plan.ts`
- Create: `src/features/home/model/payment-plan.test.ts`
- Modify: `src/features/home/components/transaction-list.tsx`
- Modify: `src/features/home/transaction-data.ts`

**Interfaces:**
- Consumes: existing transaction states and formatted labels.
- Produces: `Transaction`, `PaymentPlanTerm`, `PaymentPlan`, `StartPaymentPlanInput`, `quotePaymentPlan`, `isPayOverTimeEligible`, `formatUsd`, `getRemainingBalanceCents`, and `getStatementReductionCents`.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, test } from 'vitest'
import {
  getStatementReductionCents,
  isPayOverTimeEligible,
  quotePaymentPlan,
} from './payment-plan'

describe('payment plan domain', () => {
  test.each([
    [3, 12780, 296780, 98927],
    [6, 25560, 309560, 51593],
    [9, 38340, 322340, 35816],
  ] as const)('quotes %i months using the fixed 18%% APR', (term, fee, total, monthly) => {
    expect(quotePaymentPlan(284000, term)).toMatchObject({
      feeCents: fee,
      totalRepayableCents: total,
      monthlyPaymentCents: monthly,
    })
  })

  test('reduces this statement by the purchase less its first instalment', () => {
    expect(getStatementReductionCents(quotePaymentPlan(284000, 6))).toBe(232407)
  })

  test.each([
    ['USD', 100001, 'completed', false, true],
    ['USD', 100000, 'completed', false, false],
    ['EUR', 200000, 'completed', false, false],
    ['USD', 200000, 'reversed', false, false],
    ['USD', 200000, 'pending', true, false],
  ] as const)(
    'checks currency, threshold, state, and active-plan ownership',
    (currency, amountCents, state, hasPlan, expected) => {
      expect(isPayOverTimeEligible({ currency, amountCents, state }, hasPlan)).toBe(expected)
    },
  )
})
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `pnpm test -- src/features/home/model/payment-plan.test.ts`

Expected: FAIL because `payment-plan.ts` does not exist.

- [ ] **Step 3: Add the typed transaction and plan models**

```ts
export const PAYMENT_PLAN_TERMS = [3, 6, 9] as const
export type PaymentPlanTerm = (typeof PAYMENT_PLAN_TERMS)[number]
export const PAYMENT_PLAN_APR_BASIS_POINTS = 1800

export interface PaymentPlanQuote {
  termMonths: PaymentPlanTerm
  aprBasisPoints: number
  principalCents: number
  feeCents: number
  totalRepayableCents: number
  monthlyPaymentCents: number
}

export function quotePaymentPlan(
  principalCents: number,
  termMonths: PaymentPlanTerm,
): PaymentPlanQuote {
  const feeCents = Math.round(
    (principalCents * PAYMENT_PLAN_APR_BASIS_POINTS * termMonths) / 12 / 10_000,
  )
  const totalRepayableCents = principalCents + feeCents
  return {
    termMonths,
    aprBasisPoints: PAYMENT_PLAN_APR_BASIS_POINTS,
    principalCents,
    feeCents,
    totalRepayableCents,
    monthlyPaymentCents: Math.round(totalRepayableCents / termMonths),
  }
}
```

Define `PaymentPlan` with `id`, `transactionId`, `merchant`, `currency`, quote fields,
`paidInstallments`, and ISO `startedAt`. Define `Transaction` in `model/transaction.ts` with the
existing fields plus `amountCents` and `currency`. Update every mock transaction with exact
numeric cents rather than deriving them from `amount`.

- [ ] **Step 4: Move imports to the model and run tests**

Run: `pnpm test -- src/features/home/model/payment-plan.test.ts src/features/home/home-screen.test.tsx src/features/home/transactions-screen.test.tsx`

Expected: PASS with existing transaction rendering unchanged.

- [ ] **Step 5: Commit the domain slice**

```bash
git add src/features/home/model src/features/home/components/transaction-list.tsx src/features/home/transaction-data.ts
git commit -m "feat: add payment plan domain model"
```

---

### Task 2: API-ready gateway and provider

**Files:**
- Modify: `src/shared/api/gateway-result.ts`
- Create: `src/features/home/api/payment-plans-gateway.ts`
- Create: `src/features/home/api/mock-payment-plans-gateway.ts`
- Create: `src/features/home/api/mock-payment-plans-gateway.test.ts`
- Create: `src/features/home/model/payment-plans-state.ts`
- Create: `src/features/home/model/payment-plans-state.test.ts`
- Create: `src/features/home/payment-plans-provider.tsx`
- Modify: `src/app/root-route.tsx`

**Interfaces:**
- Consumes: `PaymentPlan`, `StartPaymentPlanInput`, `GatewayResult`.
- Produces: `PaymentPlansGateway`, `mockPaymentPlansGateway`, `PaymentPlansProvider`, and `usePaymentPlans()` with `state`, `startPlan`, `settlePlan`, and `resetSession`.

- [ ] **Step 1: Generalize gateway success data and write gateway tests**

```ts
type GatewaySuccess<Data> = [Data] extends [void]
  ? { ok: true }
  : { ok: true; data: Data }

export type GatewayResult<Data = void> =
  | GatewaySuccess<Data>
  | { ok: false; code: string; message: string }
```

```ts
test('starts a typed plan from numeric input', async () => {
  const result = await mockPaymentPlansGateway.start({
    transactionId: 'emirates',
    merchant: 'Emirates Airlines',
    currency: 'USD',
    principalCents: 284000,
    termMonths: 6,
  })
  expect(result.ok && result.data.monthlyPaymentCents).toBe(51593)
})
```

- [ ] **Step 2: Run gateway tests and verify RED**

Run: `pnpm test -- src/features/home/api/mock-payment-plans-gateway.test.ts`

Expected: FAIL because the gateway files do not exist.

- [ ] **Step 3: Implement the gateway contract and mock adapter**

```ts
export interface PaymentPlansGateway {
  list(): Promise<GatewayResult<readonly PaymentPlan[]>>
  start(input: StartPaymentPlanInput): Promise<GatewayResult<PaymentPlan>>
  settle(planId: string): Promise<GatewayResult>
}
```

The mock `list()` returns an empty array, `start()` returns a plan with a stable ID derived from the
transaction ID and an injected/current ISO clock value, and `settle()` returns `{ ok: true }`. Map
unexpected rejections to `{ code: 'unexpected-error', message: 'Unable to update the plan. Try again.' }`.

- [ ] **Step 4: Write reducer tests for list, start, settle, failure, and reset**

```ts
const started = paymentPlansReducer(createPaymentPlansState(), {
  type: 'planStarted',
  plan,
})
expect(started.plans).toEqual([plan])
expect(paymentPlansReducer(started, { type: 'planSettled', planId: plan.id }).plans).toEqual([])
expect(paymentPlansReducer(started, { type: 'sessionReset' })).toEqual(createPaymentPlansState())
```

- [ ] **Step 5: Implement provider orchestration**

Use `useReducer`, one `pendingRef`, and `useCallback`. `startPlan` and `settlePlan` return their typed
gateway result so screens can keep dialogs open on failure. Dispatch only user-safe messages. The
provider starts `list()` in an effect and ignores its result after unmount. `resetSession()` clears the
provider state and increments a revision ref so stale async completions cannot repopulate a signed-out
session.

- [ ] **Step 6: Mount the provider and run focused tests**

```tsx
<PaymentPlansProvider gateway={mockPaymentPlansGateway}>
  <PrivatePageShell>
    <Outlet />
  </PrivatePageShell>
</PaymentPlansProvider>
```

Run: `pnpm test -- src/features/home/api/mock-payment-plans-gateway.test.ts src/features/home/model/payment-plans-state.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the boundary slice**

```bash
git add src/shared/api/gateway-result.ts src/features/home/api src/features/home/model/payment-plans-state.ts src/features/home/model/payment-plans-state.test.ts src/features/home/payment-plans-provider.tsx src/app/root-route.tsx
git commit -m "feat: add payment plans gateway"
```

---

### Task 3: Eligible transaction and plan-start flow

**Files:**
- Create: `src/features/home/components/payment-plan-selector.tsx`
- Create: `src/features/home/components/payment-plan-start-modal.tsx`
- Create: `src/features/home/payment-plan-notifications.ts`
- Modify: `src/features/home/components/transaction-list.tsx`
- Modify: `src/features/home/components/transaction-detail-modal.tsx`
- Modify: `src/features/home/home-screen.tsx`
- Modify: `src/features/home/transactions-screen.tsx`
- Modify: `src/features/home/home-screen.test.tsx`
- Modify: `src/features/home/transactions-screen.test.tsx`
- Modify: `src/app/routes/home.tsx`
- Modify: `src/app/routes/transactions.tsx`
- Download if needed: `public/assets/home/pay-over-time.svg`

**Interfaces:**
- Consumes: `PaymentPlan`, `PaymentPlanTerm`, `StartPaymentPlanInput`, provider `startPlan`.
- Produces: eligible Activity affordance, reusable term selector, and start modal used by Home and full Transactions.

- [ ] **Step 1: Add failing static UI tests**

```ts
expect(renderTransaction(emirates, [])).toContain('Pay over time')
expect(renderTransaction(reversedHarrods, [])).not.toContain('Pay over time')
expect(renderTransaction(emirates, [activePlan])).toContain('PLAN')
expect(renderTransaction(emirates, [activePlan])).toContain('USD 515.93/mo')
```

Add modal assertions for the 3/6/9 choices, default 6-month active styling, `18.0% APR fixed`, fee,
total repayable, and `START PLAN — USD 515.93/MO`.

- [ ] **Step 2: Run Home and Transactions tests and verify RED**

Run: `pnpm test -- src/features/home/home-screen.test.tsx src/features/home/transactions-screen.test.tsx`

Expected: FAIL because plan props and components are missing.

- [ ] **Step 3: Extend transaction presentation without duplicating rows**

Add optional `paymentPlan?: PaymentPlan` and `canPayOverTime?: boolean` presentation inputs.
`TransactionRow` renders the Figma `PLAN` badge and monthly secondary amount for an active plan;
otherwise eligible rows render the clock asset and `Pay over time`. Keep the existing full-width press
highlight and inner scale behavior.

- [ ] **Step 4: Extend the shared detail modal**

Add optional `paymentPlan`, `canPayOverTime`, and `onPayOverTime`. Eligible details render one full-width
primary button before Close/Dispute. Active-plan details render a `Plan` row such as
`6 months · USD 515.93/mo`, the remaining-balance status message from Figma, and do not render the CTA.

- [ ] **Step 5: Implement selector and modal**

`PaymentPlanSelector` maps `PAYMENT_PLAN_TERMS` to quote cards with `aria-pressed`. The selection modal
owns only the selected term and renders state passed from its parent. It uses `ModalShell`, `InfoBanner`,
`Button`, and padding rather than a fixed panel height. Cancellation is disabled only during submission.

- [ ] **Step 6: Wire Home and Transactions routes**

Both screens derive active plans by `transactionId`, compute eligibility with the domain function, and
replace the detail modal with `PaymentPlanStartModal` when requested. Await `startPlan`; on success close
the modal and call:

```ts
toast(`PLAN STARTED · ${formatUsd(plan.monthlyPaymentCents)}/MO`)
```

On failure keep the modal open and render the returned safe message. Routes obtain the provider value
and pass `plans` plus `startPlan` to the screens.

- [ ] **Step 7: Run focused tests and commit**

Run: `pnpm test -- src/features/home/home-screen.test.tsx src/features/home/transactions-screen.test.tsx src/features/home/model/payment-plan.test.ts`

Expected: PASS.

```bash
git add public/assets/home src/features/home/components src/features/home/home-screen.tsx src/features/home/transactions-screen.tsx src/features/home/payment-plan-notifications.ts src/features/home/*.test.tsx src/app/routes/home.tsx src/app/routes/transactions.tsx
git commit -m "feat: add pay over time selection flow"
```

---

### Task 4: Payment plans section, details, and early settlement

**Files:**
- Create: `src/features/home/components/payment-plans-section.tsx`
- Create: `src/features/home/components/payment-plan-details-modal.tsx`
- Create: `src/features/home/components/settle-payment-plan-modal.tsx`
- Create: `src/features/home/components/payment-plans-section.test.tsx`
- Modify: `src/features/home/home-screen.tsx`
- Modify: `src/features/home/home-screen.test.tsx`
- Modify: `src/app/routes/home.tsx`

**Interfaces:**
- Consumes: active `PaymentPlan[]`, `settlePlan(planId)`.
- Produces: conditional Home section, details modal, settlement confirmation, and session reset on sign out.

- [ ] **Step 1: Write failing component tests**

```ts
expect(renderToStaticMarkup(<PaymentPlansSection plans={[]} onSelect={() => {}} />)).toBe('')
expect(renderPlanSection([plan])).toContain('Payment plans')
expect(renderPlanSection([plan])).toContain('USD 515.93/mo')
expect(renderPlanSection([plan])).toContain('0% paid')
```

Add assertions that details show monthly, term, rate, fee, progress, settle amount, and that the
confirmation copy/action labels exactly match Figma.

- [ ] **Step 2: Run the section test and verify RED**

Run: `pnpm test -- src/features/home/components/payment-plans-section.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the conditional section and progress row**

Render the section only when `plans.length > 0`, immediately after Activity. Use a semantic button for
the entire plan row. Compute progress as `paidInstallments / termMonths`, clamp to 0–100%, and render
the two-pixel track using percentage width without assigning a fixed row height.

- [ ] **Step 4: Implement details and confirmation modals**

The details modal uses shared detail-row styling and `ModalShell`. The confirmation modal uses
`ModalShell` and `ModalActions`, disables both actions during settlement, and preserves the transaction
modal backdrop treatment. No background click closes a pending confirmation.

- [ ] **Step 5: Wire settlement and sign-out reset**

Home stores the selected plan ID. Opening confirmation closes details, matching the Figma transition.
Await `settlePlan`; on success close confirmation and emit `PLAN SETTLED`. On failure retain the dialog
with a safe message. `HomeRoute.handleSignOut` calls `resetSession()` before auth sign out and route
replacement.

- [ ] **Step 6: Run focused tests and commit**

Run: `pnpm test -- src/features/home/components/payment-plans-section.test.tsx src/features/home/home-screen.test.tsx src/features/home/model/payment-plans-state.test.ts`

Expected: PASS.

```bash
git add src/features/home/components/payment-plan* src/features/home/home-screen.tsx src/features/home/home-screen.test.tsx src/app/routes/home.tsx
git commit -m "feat: add payment plan management"
```

---

### Task 5: Pay Now statement disclosure

**Files:**
- Create: `src/features/payment/statement-plan-disclosure.tsx`
- Create: `src/features/payment/statement-plan-disclosure.test.tsx`
- Modify: `src/features/payment/payment-screen.tsx`
- Modify: `src/features/payment/payment-screen.test.tsx`
- Modify: `src/app/routes/payment.tsx`
- Modify if required by Figma export: `public/assets/payment/plan-chevron.svg`

**Interfaces:**
- Consumes: provider `PaymentPlan[]` mapped by the app route.
- Produces: `StatementPlanAdjustment` and an expandable statement summary without coupling payment UI to the Home feature.

- [ ] **Step 1: Write failing disclosure tests**

```ts
const adjustment = {
  id: 'plan-emirates',
  merchant: 'Emirates Airlines',
  originalAmount: 'USD 2,840.00',
  monthlyPayment: 'USD 515.93/mo',
  termLabel: '6 months',
  reductionCents: 232407,
  reduction: '−USD 2,324.07',
}

expect(renderDisclosure([adjustment], true)).toContain('Lower this statement by USD 2,324.07')
expect(renderDisclosure([adjustment], true)).toContain('only its first instalment stays')
expect(renderDisclosure([], false)).toBe('')
```

- [ ] **Step 2: Run payment tests and verify RED**

Run: `pnpm test -- src/features/payment/statement-plan-disclosure.test.tsx src/features/payment/payment-screen.test.tsx`

Expected: FAIL because the disclosure component and props do not exist.

- [ ] **Step 3: Implement the disclosure component**

Export `StatementPlanAdjustment` from the payment feature. The disclosure receives formatted props,
stays independent of the Home model, sums numeric `reductionCents` for its heading, is expanded by
default when non-empty, and exposes `aria-expanded` plus an accessible label. Use the exact Figma
chevron asset when needed.

- [ ] **Step 4: Integrate with PaymentSummary and route mapping**

`PaymentScreen` accepts `planAdjustments?: readonly StatementPlanAdjustment[]`. The existing statement,
bank, crypto, QR, copy, warning, and concierge behavior remains unchanged. `PaymentRoute` maps provider
plans to adjustments using `formatUsd` and `getStatementReductionCents`; this is the only place where
the Home feature model meets the Payment feature input.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm test -- src/features/payment/statement-plan-disclosure.test.tsx src/features/payment/payment-screen.test.tsx src/features/payment/payment-services.test.ts`

Expected: PASS.

```bash
git add public/assets/payment src/features/payment src/app/routes/payment.tsx
git commit -m "feat: show payment plans in pay now"
```

---

### Task 6: Route generation, full regression checks, and visual validation

**Files:**
- Regenerate: `src/app/routeTree.gen.ts` only if the router plugin changes it during build.
- Modify only when a visual mismatch is observed: files created or changed in Tasks 1–5.

**Interfaces:**
- Consumes: the complete flow.
- Produces: verified responsive implementation matching Figma node `303:56687`.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all tests pass, TypeScript and ESLint exit 0, Vite production build exits 0, and diff check is empty.

- [ ] **Step 2: Exercise the complete flow at 375 CSS pixels**

Open Home, verify only eligible rows show Pay over time, create a 6-month Emirates plan, inspect the
toast, Activity monthly amount, Payment plans section, details modal, Pay Now expanded/collapsed
disclosure, settle confirmation, settled toast, section removal, and restored eligibility.

- [ ] **Step 3: Repeat responsive checks at 320 CSS pixels**

Verify no horizontal document scrolling, no clipped merchant/amount text, no fixed modal/page height,
modal scrolling does not move the background, and all actions remain reachable.

- [ ] **Step 4: Compare against the Figma screenshots**

Check typography, borders, background colors, modal widths, option selected state, progress track,
section spacing, transaction badge/icon, Pay Now disclosure, and toast copy. Apply only targeted visual
corrections and rerun the relevant focused test after each correction.

- [ ] **Step 5: Final review and commit**

Run the full automated check block again after any visual correction, inspect `git status --short` and
`git diff --stat`, then commit only remaining generated or visual-parity changes:

```bash
git add src public
git commit -m "fix: align pay over time with figma"
```
