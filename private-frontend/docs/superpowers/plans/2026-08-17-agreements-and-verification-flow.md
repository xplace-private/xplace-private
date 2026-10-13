# Agreements and Verification Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled agreement disclosures and continue completed onboarding into a mocked two-state verification screen.

**Architecture:** The onboarding feature owns the agreement UI and emits completion to its route. A separate verification feature owns a typed, abortable gateway and renders one shared status layout for both Figma states; the `/verification` route injects the mock gateway.

**Tech Stack:** React 19, strict TypeScript, TanStack Router, Tailwind CSS v4, Vitest.

## Global Constraints

- Match Figma nodes `293:43775`, `293:43926`, and `293:43968`.
- Only one agreement disclosure may be open; expanded content uses `max-height: 190px` and internal scrolling.
- Do not animate content entrance, accordion height, or verification status changes.
- The mock resolves `verified` after exactly 1000ms and must be abortable.
- Reuse `PrivatePageShell` and do not reproduce phone or browser chrome.
- Do not add dependencies or edit `src/app/routeTree.gen.ts` manually.

---

### Task 1: Controlled agreement disclosures

**Files:**
- Create: `src/features/onboarding/components/agreement-disclosure.test.tsx`
- Create: `src/features/onboarding/components/agreement-disclosure.tsx`
- Modify: `src/features/onboarding/components/agreements-step.tsx`

**Interfaces:**
- Produces: `AgreementDisclosure({ id, title, expanded, children, onToggle })`.
- Consumes: existing `Button`, `OnboardingStepLayout`, and step 6 acceptance state.

- [ ] **Step 1: Write failing disclosure render tests**

Render closed and expanded `AgreementDisclosure` instances with `renderToStaticMarkup`. Assert literal `aria-expanded` values, `+` / `−`, body visibility, and the expanded content text.

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/features/onboarding/components/agreement-disclosure.test.tsx`

Expected: FAIL because `agreement-disclosure.tsx` does not exist.

- [ ] **Step 3: Implement the controlled disclosure**

Use a semantic button with `aria-expanded` and `aria-controls`. Render the content only when expanded inside a `max-h-[190px] overflow-y-auto` region styled to the Figma values.

- [ ] **Step 4: Wire the two agreements**

Store `openAgreement: 'cardholder' | 'privacy' | null` in `AgreementsStep`. Toggle the requested id and close the previous id. Use the complete Figma cardholder copy and `Temporary privacy policy text.` for Privacy Policy.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test src/features/onboarding/components/agreement-disclosure.test.tsx`

Expected: PASS.

---

### Task 2: Abortable verification gateway and status UI

**Files:**
- Create: `src/features/verification/api/verification-gateway.ts`
- Create: `src/features/verification/api/mock-verification-gateway.ts`
- Create: `src/features/verification/api/mock-verification-gateway.test.ts`
- Create: `src/features/verification/verification-status-view.tsx`
- Create: `src/features/verification/verification-status-view.test.tsx`
- Create: `src/features/verification/verification-screen.tsx`

**Interfaces:**
- Produces: `VerificationStatus = 'under-review' | 'verified'`.
- Produces: `VerificationGateway.waitForVerification(signal: AbortSignal): Promise<'verified'>`.
- Produces: `VerificationScreen({ gateway })` and pure `VerificationStatusView({ status })`.

- [ ] **Step 1: Write failing mock timing tests**

With Vitest fake timers, assert the promise is unresolved at 999ms, resolves to the literal `verified` at 1000ms, and rejects with `AbortError` after abort.

- [ ] **Step 2: Verify gateway RED**

Run: `pnpm test src/features/verification/api/mock-verification-gateway.test.ts`

Expected: FAIL because the verification gateway files do not exist.

- [ ] **Step 3: Implement the gateway**

Create an abort-aware 1000ms timer. Remove the abort listener on resolution and clear the timer on abort.

- [ ] **Step 4: Verify gateway GREEN**

Run: `pnpm test src/features/verification/api/mock-verification-gateway.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing status-view tests**

Render both statuses with `renderToStaticMarkup`. Assert the exact title, description, identity label, and unchanged Limit, Card, and Annual membership values.

- [ ] **Step 6: Verify status-view RED**

Run: `pnpm test src/features/verification/verification-status-view.test.tsx`

Expected: FAIL because the status view does not exist.

- [ ] **Step 7: Implement status view and screen controller**

Build the shared 40px-padded Figma layout and four-row status card. `VerificationScreen` starts at `under-review`, calls the gateway in an effect, updates to `verified`, and aborts on cleanup.

- [ ] **Step 8: Verify status-view GREEN**

Run: `pnpm test src/features/verification/verification-status-view.test.tsx`

Expected: PASS.

---

### Task 3: Completion navigation and route composition

**Files:**
- Modify: `src/features/onboarding/components/agreements-step.tsx`
- Modify: `src/features/onboarding/onboarding-screen.tsx`
- Modify: `src/app/routes/onboarding.tsx`
- Create: `src/app/routes/verification.tsx`
- Generated by tooling: `src/app/routeTree.gen.ts`

**Interfaces:**
- `OnboardingScreen` consumes `onCompleted(): void`.
- `AgreementsStep` calls `onCompleted` only when `continueStep()` returns `true`.
- `/verification` injects `mockVerificationGateway` into `VerificationScreen`.

- [ ] **Step 1: Wire successful completion intent**

Await the existing step 6 submission result. Call `onCompleted()` only on success and keep validation failures on step 6.

- [ ] **Step 2: Add the route**

Create the `/verification` file route and update `/onboarding` composition to push `/verification` on completion.

- [ ] **Step 3: Run the complete automated verification**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && git diff --check`

Expected: all tests pass and every command exits with status 0.

- [ ] **Step 4: Validate against Figma in the browser**

Verify at the running local site: one-open accordion behavior, internal overflow, failed agreement validation, successful `/verification` navigation, initial under-review state, and automatic verified state after one second.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-08-17-agreements-and-verification-flow.md src/features/onboarding src/features/verification src/app/routes src/app/routeTree.gen.ts
git commit -m "feat: add agreement and verification flow"
```
