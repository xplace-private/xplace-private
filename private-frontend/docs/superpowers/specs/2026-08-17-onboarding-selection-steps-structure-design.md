# Onboarding Selection Steps Structure

## Goal

Remove the inconsistent file structure around onboarding selection steps without changing their UI or behavior.

## Design

- Steps 1, 3, 4, and 5 are plain single-choice screens. Define their copy and options as configuration and render all four through `OnboardingSelectionStep` from `OnboardingScreen`.
- Step 2 remains a dedicated `OccupationStep` because it owns search input and filtering behavior.
- Step 6 remains a dedicated `AgreementsStep` because it renders agreement disclosures and acceptance rather than a plain selection list.
- Delete the redundant `ResidencyStep` wrapper.
- Keep navigation, validation, gateway submission, warnings, spacing, and accessibility behavior unchanged.

## Verification

- Existing onboarding model and gateway tests continue to pass.
- Component tests cover the shared selection renderer.
- Typecheck, lint, build, and diff checks pass.
- The full six-step browser flow remains visually and functionally unchanged.
