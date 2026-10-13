# Onboarding steps 3–6 design

## Scope

Extend the existing `/onboarding` mock flow from two to six sequential steps and
implement the four supplied Figma frames. Refactor steps 1 and 2 onto the same
step primitives so every onboarding screen uses the same spacing, validation,
actions, and submission behavior.

## Screens

1. Residency selection.
2. Occupation search and selection.
3. Yearly income selection:
   - Less than USD 25,000
   - USD 25,000 – 50,000
   - USD 50,000 – 100,000
   - USD 100,000 – 180,000
   - More than USD 180,000
4. Expected monthly spend selection:
   - Less than USD 1,000
   - USD 1,000 – 5,000
   - USD 5,000 – 25,000
   - USD 25,000 – 50,000
   - More than USD 50,000
5. Account purpose selection:
   - Personal spending
   - Business expenses
   - Investments
   - Something else
6. Agreement acknowledgement with two disclosure-style rows and one acceptance
   choice.

## Component design

`OnboardingStepLayout` owns the shared vertical rhythm: heading, form content,
validation message, and action group. It receives the step copy and renders
step-specific controls through children.

`OnboardingSelectionStep` composes `OnboardingStepLayout`, `OptionList`, and
`OptionButton` for data-driven single-choice steps. Steps 1, 3, 4, and 5 use it
directly. Step 2 uses `OnboardingStepLayout` with its search field and the same
option primitives. This keeps the search-specific behavior local without
duplicating the page template.

`AgreementsStep` uses `OnboardingStepLayout` but owns its disclosure rows and
acceptance choice. The disclosure rows are accessible buttons with the closed
state shown in Figma; they do not invent document content or URLs that product
has not supplied.

All controls remain feature-owned. Existing shared UI components remain the
source for primary and secondary buttons, headings, and the page shell.

## State and gateway boundary

The onboarding state becomes a discriminated six-step draft with nullable
values for residency, occupation, yearly income, monthly spend, account
purpose, and agreement acceptance. Each setter clears only its field's current
warning.

`OnboardingStepPayload` gains one typed payload variant per step. The provider
validates the current step, submits only that step through `OnboardingGateway`,
and advances only after a successful result. Back moves to the preceding step
without clearing draft values. Duplicate submissions and draft changes remain
blocked while a request is pending.

The mock gateway accepts all six payload variants. After successful step 6 it
marks the flow complete and leaves the user on the final screen because no next
screen or route was supplied.

## Validation and interaction

Continue requires a valid selection on every step. A missing value applies the
existing warning border and `Select to continue` message. Step 6 requires the
acceptance choice. Selecting a value removes its warning immediately.

Option lists retain the current five-visible-item cap and custom persistent
scroll indicator when they contain more than five items. The new choice lists
contain five or fewer items, so they do not introduce nested scrolling.

No content-entry animation is added. Existing press feedback remains.

## Visual rules

The Figma spacing is shared across all six steps:

- 40px section padding above and below;
- 32px between heading and controls;
- 10px between option tiles;
- 16px between Continue and Back;
- identical warning placement between controls and actions.

Typography, colors, borders, option padding, and button variants reuse the
current project components where they already match the supplied frames.

## Verification

- Reducer tests cover step validation, forward/back navigation, value
  preservation, pending-state blocking, and final completion.
- Gateway tests cover all six payload variants.
- Browser verification covers all six screens at 320px and 375px widths,
  missing-selection warnings, forward/back flow, option selection, and no
  horizontal overflow.
- Run the complete test suite, typecheck, lint, production build, and diff
  whitespace check.
