# Persistent App Bar Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the app bar mounted across routes and make auth secondary buttons size from padding without internal wrapping.

**Architecture:** `RootRoute` owns one persistent `PrivatePageShell` around the router outlet. The shell fills the dynamic viewport, the app bar is an absolute overlay, and only the content/footer container scrolls. Secondary auth buttons use intrinsic dimensions.

**Tech Stack:** React 19, strict TypeScript, TanStack Router, Tailwind CSS v4, Vitest.

## Global Constraints

- Do not add dependencies.
- Preserve existing Figma copy, colors, press effects, fixed header, and safe-area padding.
- Do not add content entrance animations.
- Secondary auth buttons use padding and `white-space: nowrap`, not fixed width or height.
- Preserve mobile support at 320 CSS pixels and prevent horizontal overflow.

---

### Task 1: Persistent shell and intrinsic buttons

**Files:**
- Modify: `src/shared/ui/private-page-shell.tsx`
- Modify: `src/app/root-route.tsx`
- Modify: `src/features/auth/auth-screen.tsx`
- Modify: `src/features/onboarding/onboarding-screen.tsx`
- Modify: `src/features/auth/components/code-step.tsx`

**Interfaces:**
- `PrivatePageShell` remains the public shared shell component and gains no new props.

- [ ] **Step 1: Keep the shell mounted at the root**

Wrap `<Outlet />` with `<PrivatePageShell>` in `RootRoute`. Remove the shell import/wrapper from `AuthScreen` and `OnboardingScreen`, leaving each feature screen responsible only for its active step.

- [ ] **Step 2: Remove fixed secondary-button dimensions**

Change the code-step secondary class to intrinsic sizing:

```ts
'inline-flex items-center justify-center whitespace-nowrap border border-[#2b2b2b] bg-transparent px-[18px] py-[10px] ...'
```

Remove `w-[140px]` from the resend button. Keep the parent row wrapping whole buttons when necessary.

- [ ] **Step 3: Isolate scrolling inside the shell**

Make the shell `h-dvh overflow-hidden`. Change the persistent app bar from `fixed` to `absolute`, keep it above the content with the existing z-index, safe-area height, background, and blur, and remove the ineffective upward pseudo-element. Make the content/footer wrapper `h-full min-h-0 overflow-y-auto overscroll-y-contain` so the document never scrolls while content continues beneath the app-bar overlay.

- [ ] **Step 4: Verify regressions**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands pass with pristine output.

- [ ] **Step 5: Browser verification**

At 320, 375, and 390 CSS pixels, verify app-bar DOM identity survives `/` → `/onboarding`, resend text remains one line, no horizontal overflow occurs, fixed scrolling remains correct, and the console stays clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ui/private-page-shell.tsx src/app/root-route.tsx src/features/auth/auth-screen.tsx src/features/onboarding/onboarding-screen.tsx src/features/auth/components/code-step.tsx
git commit -m "fix: stabilize app bar across mobile flows"
```
