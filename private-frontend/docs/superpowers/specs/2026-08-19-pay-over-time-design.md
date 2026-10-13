# Pay over time design

## Scope

Implement the complete Pay over time flow from Figma section `303:56687`:

- surface eligibility on qualifying Activity transactions;
- let the member choose a 3, 6, or 9 month plan;
- create a mocked in-memory plan and reflect it across Home and Pay Now;
- show active plans and their progress on Home;
- expose plan information in transaction details;
- let the member settle an active plan early with confirmation;
- remove settled plans and restore transaction eligibility;
- keep all state ephemeral, resetting on reload and sign out.

No real network calls, persistence, payment collection, or server authorization are in scope.

## Product rules

A transaction is eligible when all of the following are true:

- its billing currency is USD;
- its numeric amount is strictly greater than USD 1,000;
- its state is `completed` or `pending`;
- it does not already have an active payment plan.

Refunded, reversed, and declined transactions are not eligible. Settling a plan makes its
transaction eligible again while the transaction otherwise continues to satisfy the rules.

The available terms are 3, 6, and 9 months with a fixed 18% APR. Calculations use integer cents:

```text
feeCents = round(principalCents * APR * termMonths / 12)
totalRepayableCents = principalCents + feeCents
monthlyPaymentCents = round(totalRepayableCents / termMonths)
statementReductionCents = principalCents - monthlyPaymentCents
```

All domain amounts use integer cents and display with two decimal places. This matches the Figma
quotes while allowing a rounded monthly instalment to differ from an exact total divided by the term
by at most one cent. API data can replace the mocks without parsing display strings.

New plans start with zero paid instalments. Their progress bar is present at 0%, and progress fields
are ready to consume paid-instalment data from the future API.

## Data boundary

Create a feature-owned `PaymentPlansGateway` contract with asynchronous operations:

- `list()` returns active plans;
- `start(input)` creates and returns a plan;
- `settle(planId)` settles an active plan.

The initial implementation injects `mockPaymentPlansGateway`. It simulates asynchronous typed gateway
results while the provider owns the in-memory collection. A future HTTP adapter can replace it in
application composition without changing screens, modal components, or domain calculations.

Mount a payment-plan provider in the root application composition. It owns loading, success, and
expected error state, and exposes intents rather than its storage implementation. Home consumes the
plan collection and mutation intents. The Pay Now route consumes read-only statement adjustments
derived from the same collection.

The provider also exposes a client-only session reset intent. Sign out clears the provider cache; this
is not part of the server gateway because signing out must not delete real payment plans.

The transaction model gains explicit numeric USD amount data alongside its existing formatted
labels. Eligibility and plan calculations never parse `"USD 2,840"` strings.

## State and flow

### Starting a plan

1. The member opens an eligible transaction from Activity or the full transaction list.
2. The existing transaction detail modal renders `PAY OVER TIME` above the existing close/dispute
   actions.
3. The selection modal shows the purchase, 3/6/9 month choices, fixed rate, fee, total repayable,
   the existing informational banner style, and start/cancel actions.
4. Six months is selected by default, matching the Figma reference; selecting another option only
   updates the quoted values.
5. Start is disabled while the mock request is pending and duplicate submission is prevented.
6. On success, the selection flow closes and a `PLAN STARTED · <monthly amount>/MO` toast appears.
7. Home immediately reflects the plan in Activity and in the new Payment plans section.

### Active plan presentation

Activity keeps the original transaction amount as the primary value and replaces the secondary
right-side value with the monthly payment. A `PLAN` badge appears beside the merchant. The row
remains clickable.

The transaction modal for an active plan shows its current status message and a `Plan` detail row
with term and monthly amount. It does not show another Pay over time action.

The Payment plans section is absent when there are no active plans. When present, it sits after
Activity and before Your cards. Each plan row shows merchant, monthly amount, term, remaining amount,
start date, and a two-pixel progress track. The whole row opens plan details.

### Plan details and settlement

Plan details reuse the shared modal shell and show remaining balance, monthly payment, term, fixed
rate, fee, paid progress, and the amount required to settle today. `SETTLE PLAN NOW` opens a compact
confirmation dialog using the same background and action components as existing transaction/card
modals.

While settlement is pending, confirmation actions are disabled. On success, both dialogs close, the
plan disappears, a `PLAN SETTLED` toast appears, and the transaction returns to its ordinary eligible
Activity presentation.

Expected gateway failures keep the current modal open and display a concise user-safe inline error.
Raw external errors are never rendered.

## Pay Now integration

When there are active plans, the existing statement summary gains a disclosure row:

`Lower this statement by <combined statement reduction>`

It is expanded by default on route entry, matching the first Pay Now state in Figma. The member may
collapse or expand it. The expanded content explains that only the first instalment remains on the
statement and lists one adjustment per active plan with merchant, original amount, monthly payment,
term, and the reduction for this month.

The existing bank/crypto tabs, real QR generation, copy actions, warnings, and payment-details data
contract remain unchanged. With no active plans the payment screen keeps its current layout.

## Components and reuse

Reuse existing primitives:

- `ModalShell` for every dialog;
- `ModalActions` for paired confirmation actions;
- `Button`, `InfoBanner`, `SectionHeader`, and `SectionDivider`;
- `TransactionList`, `TransactionRow`, and `TransactionDetailModal` through optional plan props;
- the existing Sonner toaster.

Add focused feature components:

- `PaymentPlanSelector` for reusable term option rendering and selection;
- `PaymentPlanStartModal` for quote and submission state;
- `PaymentPlansSection` and `PaymentPlanRow` for Home;
- `PaymentPlanDetailsModal` for active-plan information;
- `SettlePaymentPlanModal` for confirmation;
- `StatementPlanDisclosure` for Pay Now.

Do not create a new generic component when an existing primitive already expresses the layout. New
components remain padding-driven and responsive rather than copying Figma's fixed phone/frame
heights.

## Assets and responsive behavior

Reuse existing transaction back, information, and loader assets when their glyphs match. Download
and commit the exact Figma chevron asset only if the existing asset does not match. Do not add an icon
package or hand-author replacement SVG paths.

The UI remains usable at 320 CSS pixels, has no fixed page or modal content height, keeps containers
shrinkable, and uses the existing scroll-lock behavior. Long merchant names and formatted amounts
must not create horizontal document scrolling.

## Verification

Add tests for:

- eligibility by currency, threshold, state, and existing-plan status;
- 3/6/9 month fee, total, monthly, and statement-reduction calculations;
- gateway list/start/settle behavior and safe failures;
- reducer/provider duplicate-request prevention, session reset, and state updates;
- transaction row and modal states before and after plan creation;
- Payment plans zero state, active row, progress, details, and settlement;
- Pay Now disclosure expansion, collapse, combined reduction, and no-plan state;
- sign-out reset.

Run the complete test suite, typecheck, lint, production build, and `git diff --check`. Validate the
implemented flow against the Figma screenshots at 320 and 375 CSS pixels, including modal scrolling
and the Pay Now expanded/collapsed states.
