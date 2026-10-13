# Onboarding Selection Steps Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every plain single-choice onboarding step through the same shared component without a redundant residency wrapper.

**Architecture:** Keep `OnboardingSelectionStep` as the shared renderer. Configure steps 1, 3, 4, and 5 directly in `OnboardingScreen`; retain dedicated components only for occupation search and agreements because their controls differ.

**Tech Stack:** React, strict TypeScript, Vitest, Tailwind CSS v4.

## Global Constraints

- Do not change UI, copy, navigation, validation, gateway submission, spacing, or accessibility behavior.
- Keep step 2 and step 6 as dedicated components.
- Do not add dependencies or unsafe type assertions.

---

### Task 1: Remove the redundant residency wrapper

**Files:**
- Modify: `src/features/onboarding/onboarding-screen.tsx`
- Delete: `src/features/onboarding/components/residency-step.tsx`
- Verify: `src/features/onboarding/components/onboarding-selection-step.test.tsx`
- Verify: `src/features/onboarding/model/onboarding-flow.test.ts`

**Interfaces:**
- Consumes: `OnboardingSelectionStep`, `useOnboardingFlow`, and the existing residency state/actions.
- Produces: Step 1 rendered directly by `OnboardingScreen` through the same shared selection renderer as steps 3–5.

- [ ] **Step 1: Establish the regression baseline**

Run: `pnpm test`

Expected: all existing tests pass before the refactor.

- [ ] **Step 2: Inline the residency configuration**

Add the existing residency options to `onboarding-screen.tsx`, read `setResidency` from `useOnboardingFlow`, and render step 1 through `OnboardingSelectionStep` with `onBackToAuth`.

- [ ] **Step 3: Delete the redundant wrapper**

Remove `src/features/onboarding/components/residency-step.tsx` and its import. Keep `OccupationStep` and `AgreementsStep` unchanged.

- [ ] **Step 4: Verify behavior and code quality**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && git diff --check`

Expected: all tests pass and every command exits with status 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/onboarding-screen.tsx src/features/onboarding/components/residency-step.tsx docs/superpowers/plans/2026-08-17-onboarding-selection-steps-structure.md
git commit -m "refactor: unify onboarding selection steps"
```
