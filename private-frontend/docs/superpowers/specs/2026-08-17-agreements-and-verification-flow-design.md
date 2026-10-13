# Agreements and Verification Flow

## Goal

Make the final onboarding agreements interactive and continue the mock application flow on a dedicated verification route that can later use a real backend without changing the UI.

## Agreements

- Render both agreements with one reusable controlled disclosure component.
- At most one disclosure is open. Opening one closes the other; pressing the open summary closes it.
- The expanded content viewport has a maximum height of 190px and scrolls internally when its text is taller.
- Match node `293:43775`: 1px `#1c1c1c` border, 18px padding, 14px vertical gap, 13px summary, 12px body at 20.4px line height, and `+` / `−` indicator in `#4a4a4a`.
- Use the Cardholder Agreement copy shown in Figma. Use a short temporary sentence for Privacy Policy.
- Do not animate content entrance or accordion height.
- Agreement acceptance and existing validation remain unchanged.

## Verification route

- After step 6 is saved successfully, the application route navigates from `/onboarding` to `/verification`.
- Routing remains owned by `src/app/routes`; feature components emit completion intent.
- The verification feature owns a typed gateway boundary. Its mock waits exactly 1000ms and resolves the identity status as `verified`.
- The screen initially renders the Figma `293:43926` state:
  - `Checking your identity`
  - the supplied explanatory copy
  - `Identity — Under review` in `#b9b0a0`
- After the mock resolves, the same screen renders Figma `293:43968`:
  - `Account pending`
  - the supplied explanatory copy
  - `Identity — Verified` in `#7fb08a`
- The Limit, Card, and Annual membership rows remain unchanged between states.
- Use the existing `PrivatePageShell`, header, and footer. Do not reproduce the phone status bar or browser chrome shown in the Figma frames.
- No transition or content-appearance animation is added when status changes.

## Data and lifecycle

- The verification screen starts with the local state `under-review` and asks the injected gateway to await the next status.
- The gateway operation accepts an `AbortSignal`; leaving the route cancels the pending mock timer and prevents stale state updates.
- A later backend implementation can replace only the gateway while keeping the route and visual components intact.

## Verification

- Component tests cover single-open accordion behavior, closing, and accessible expanded state.
- Gateway tests cover the one-second mocked transition and cancellation.
- Screen tests cover both Figma status states.
- Browser validation covers agreement scrolling, navigation to `/verification`, and the automatic status change.
- Tests, typecheck, lint, build, and diff checks pass.
