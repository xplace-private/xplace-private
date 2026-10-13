# Auth Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the credit-card application page with Figma auth node `233:10978` and make its white Continue control the shared UI-kit primary button.

**Architecture:** Keep the existing `app -> features -> shared` dependency flow. The auth feature is decomposed into navigation, form, and footer components; `AuthScreen` only composes them in a centered mobile shell. Shared press behavior and the primary presentation live in `shared/ui/button.tsx`.

**Tech Stack:** React 19, strict TypeScript, TanStack Router, Tailwind CSS v4, Vite 8, pnpm 11.

## Global Constraints

- Figma node `233:10978` at `375 × 812` is the visual source of truth.
- Keep the navigation fixed while scrolling.
- The phone input starts empty; the UAE `+971` country control is non-functional but keeps press feedback.
- Continue has press feedback but no submit/navigation behavior.
- No content entrance animations.
- Do not add dependencies or a test runner; the user approved static and browser verification for this visual-only change.
- Do not invent URLs for Agreement or Privacy.
- Preserve PWA safe areas, zoom prevention, route fallback, 320px support, and keyboard usability.

---

### Task 1: Add exact Figma assets and the UI-kit primary button

**Files:**
- Download: `public/assets/auth/xplace-logo.png`
- Download: `public/assets/auth/language-globe.svg`
- Download: `public/assets/auth/whatsapp-outline.svg`
- Download: `public/assets/auth/country-chevron.svg`
- Modify: `src/shared/ui/button.tsx`

**Interfaces:**
- Consumes: standard `ButtonHTMLAttributes<HTMLButtonElement>`.
- Produces: `ButtonProps` with `variant?: 'default' | 'primary'`; `Button` retains the existing default press/focus behavior and adds the reusable Figma primary presentation.

- [ ] **Step 1: Download the exact assets from the Figma MCP response**

```bash
curl -L https://www.figma.com/api/mcp/asset/8ce88d89-f429-48fa-8c31-9d8d80310b6a.png -o public/assets/auth/xplace-logo.png
curl -L https://www.figma.com/api/mcp/asset/9499f804-0311-4545-b1ad-579a288294d0.svg -o public/assets/auth/language-globe.svg
curl -L https://www.figma.com/api/mcp/asset/52e529d3-2080-4223-82e8-749cfd8bfff0.svg -o public/assets/auth/whatsapp-outline.svg
curl -L https://www.figma.com/api/mcp/asset/66e29a92-c605-4f3d-9e56-5de83400e129.svg -o public/assets/auth/country-chevron.svg
```

- [ ] **Step 2: Verify each asset is non-empty and has the expected format**

Run: `file public/assets/auth/xplace-logo.png public/assets/auth/language-globe.svg public/assets/auth/whatsapp-outline.svg public/assets/auth/country-chevron.svg`

Expected: one PNG image and three SVG documents; no HTML error responses.

- [ ] **Step 3: Add the primary variant to the shared button**

Implement the following shape while preserving `type="button"` and consumer `className` overrides:

```tsx
export type ButtonVariant = 'default' | 'primary'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  default: '',
  primary:
    'h-12 w-full border border-white bg-white px-[15px] text-xs font-bold tracking-[2px] text-black uppercase duration-[240ms] hover:bg-[#f2f2f2] active:scale-[0.99] active:bg-[#e8e8e8] motion-reduce:active:scale-[0.995]',
}
```

The base classes continue to include non-selectable contents, `duration-200`, the shared easing, keyboard focus, disabled behavior, and image drag prevention. The primary variant overrides the duration and pressed scale so its slower, subtler feedback is owned by the UI-kit variant rather than the auth feature.

- [ ] **Step 4: Run static checks for the shared component**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit `0`.

- [ ] **Step 5: Commit the asset and UI-kit change**

```bash
git add public/assets/auth/xplace-logo.png public/assets/auth/language-globe.svg public/assets/auth/whatsapp-outline.svg public/assets/auth/country-chevron.svg src/shared/ui/button.tsx
git commit -m "feat: add auth primary button style"
```

---

### Task 2: Replace the auth feature with the new screen

**Files:**
- Create: `src/features/auth/components/auth-nav-bar.tsx`
- Create: `src/features/auth/components/auth-form.tsx`
- Create: `src/features/auth/components/auth-footer.tsx`
- Modify: `src/features/auth/auth-screen.tsx`
- Delete: `src/features/auth/components/auth-app-bar.tsx`
- Delete: `src/features/auth/components/application-section.tsx`
- Delete: `src/features/auth/components/credit-card-hero.tsx`
- Delete: `src/features/auth/components/phone-number-field.tsx`

**Interfaces:**
- Consumes: `Button` from `src/shared/ui/button.tsx` and the four assets from Task 1.
- Produces: `AuthNavBar`, `AuthForm`, `AuthFooter`, and the existing exported `AuthScreen` route surface.

- [ ] **Step 1: Implement `AuthNavBar`**

Use a fixed, centered, `375px`-capped header below `env(safe-area-inset-top, 0px)`:

```tsx
<header className="fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-30 mx-auto h-[66px] w-full max-w-[375px] border-b border-[#1c1c1c] bg-black/[0.82] backdrop-blur-[7px]">
  <div className="flex h-full items-center justify-between px-4">
    {/* 84.22 × 19 XPlace asset, divider, PRIVATE */}
    {/* 36px EN control and matching WhatsApp control */}
  </div>
</header>
```

The logo group uses an `11px` gap. PRIVATE is `12px`, weight `300`, letter spacing `2.6px`, color `#8c8c8c`. EN uses the shared `Button`, a `13px` globe, `11px` uppercase text with `1.4px` tracking, and a `#2b2b2b` border. WhatsApp uses the shared `Button`, a `16px` icon, and the same border. Remove every scroll listener and custom-property gradient from the old app bar.

- [ ] **Step 2: Implement `AuthForm`**

Build the exact flow layout:

```tsx
<section className="flex flex-col gap-8 px-4 py-10">
  <div className="flex flex-col gap-4">
    <p className="text-[10px] tracking-[2.6px] text-[#4a4a4a]">XPLACE PRIVATE</p>
    <h1 className="text-[32px] leading-[1.12] font-bold tracking-[-1.2px]">Apply or sign in</h1>
    <p className="text-[15px] leading-[1.6] font-light text-[#8c8c8c]">Enter your mobile number and we send a six-digit code on WhatsApp.</p>
  </div>
  <div className="flex flex-col gap-8">
    {/* 45.2px phone row: UAE control + empty tel input */}
    <Button variant="primary">Continue</Button>
  </div>
</section>
```

The UAE control is a shared `Button` with `aria-label="Country code United Arab Emirates plus nine seven one"`, the single `🇦🇪` flag item, `+971`, and the exact chevron asset. It has no `onClick`. The phone input uses `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, no `value`, no placeholder, and an accessible label. Both halves use only a `#1c1c1c` bottom border and remain shrinkable at `320px`.

- [ ] **Step 3: Implement `AuthFooter`**

Use a `#1c1c1c` top border, `16px` horizontal padding, `21.2px` top padding, and `18.905px` vertical gap. Render Agreement and Privacy as non-interactive text labels at `12px/21.6px`, weight `300`, color `#8c8c8c`, separated by `22px`. Render the exact legal sentence at `11px/19.8px`, weight `300`, color `#3a3a3a`, with bottom padding respecting `env(safe-area-inset-bottom)`.

- [ ] **Step 4: Compose the new `AuthScreen` and remove obsolete components**

`AuthScreen` keeps the solid black page and centered mobile shell. Reserve navigation space with `pt-[calc(env(safe-area-inset-top,0px)+66px)]`, then render `AuthForm` and `AuthFooter`. Remove the decorative background, credit card hero, section divider, membership content, benefit list, and all imports of deleted components.

- [ ] **Step 5: Run static checks for the feature replacement**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit `0` with no unused imports or invalid Tailwind syntax.

- [ ] **Step 6: Commit the auth feature replacement**

```bash
git add src/features/auth
git commit -m "feat: replace auth screen design"
```

---

### Task 3: Remove obsolete assets and global styles

**Files:**
- Modify: `src/app/styles.css`
- Delete when unreferenced: old files under `public/assets/auth/`
- Delete when unreferenced: old Inter files under `public/assets/fonts/`

**Interfaces:**
- Consumes: the new screen from Task 2.
- Produces: a minimal global stylesheet containing only app-wide tokens, document constraints, font stack, zoom/scroll behavior, desktop smoothing, and shared button motion.

- [ ] **Step 1: Prove which old assets are unreferenced**

Run: `rg -n "assets/auth|assets/fonts|Inter" src index.html public/manifest.webmanifest`

Expected: only the four Task 1 auth assets remain referenced; no source reference remains for the card, old background, benefit check, US flag, info, divider, or old brand fragments.

- [ ] **Step 2: Delete only the proven-unreferenced old assets**

Remove obsolete auth assets and all unused Inter files. Keep no compatibility copies. Re-run the reference search after deletion to catch broken paths.

- [ ] **Step 3: Simplify global CSS and finish the primary motion variant**

Set the app font stack to:

```css
font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
```

Remove the Inter `@font-face` rules, the five obsolete app-bar custom properties, scroll-gradient-specific CSS, and the obsolete `.continue-button` rules. Preserve `--app-background`, `--ease-out`, black document background, horizontal clipping, scrollbar hiding, `touch-action: pan-y`, and desktop font smoothing. The primary variant already owns its `240ms` duration and `scale: 0.99` pressed state in the UI kit.

- [ ] **Step 4: Run the full non-visual verification**

Run: `pnpm typecheck && pnpm lint && pnpm build && git diff --check`

Expected: all four checks exit `0`.

- [ ] **Step 5: Commit cleanup**

```bash
git add src/app/styles.css public/assets
git commit -m "chore: remove obsolete auth assets"
```

---

### Task 4: Validate responsive and visual behavior

**Files:**
- Modify only if validation finds a concrete mismatch in Task 1–3 files.

**Interfaces:**
- Consumes: the complete auth page.
- Produces: evidence that the implementation matches Figma and preserves required responsive behavior.

- [ ] **Step 1: Compare at the source viewport**

Open `http://127.0.0.1:5173/` at `375 × 812`. Capture a screenshot and compare it to Figma node `233:10978`. Verify nav height/border/blur, `40px` form padding, typography, phone underlines, `48px` primary button, footer border, and legal copy.

- [ ] **Step 2: Verify narrow mobile behavior**

Open at `320 × 700`. Confirm no horizontal overflow, country control stays intact, the empty input shrinks, and all footer text remains visible by vertical scrolling.

- [ ] **Step 3: Verify desktop presentation**

Open at `947 × 908`. Confirm the app remains a centered `375px` mobile column on a black page and the fixed navigation aligns to that column.

- [ ] **Step 4: Verify scrolling and input behavior**

Scroll until the footer is visible and confirm the navigation stays fixed. Focus the empty phone input and confirm it remains visible, accepts telephone input, and does not create document-level horizontal movement. Confirm UAE, EN, WhatsApp, and Continue show press feedback without performing unavailable actions.

- [ ] **Step 5: Run fresh final verification after any visual adjustments**

Run: `pnpm typecheck && pnpm lint && pnpm build && git diff --check`

Expected: all commands exit `0` after the final visual state.

- [ ] **Step 6: Commit any validation adjustments**

If Task 4 changed source files:

```bash
git add src public
git commit -m "fix: align auth screen with figma"
```

If Task 4 required no source change, do not create an empty commit.
