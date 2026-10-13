# Persistent App Bar Fix Design

## Scope

Fix two regressions in the existing authentication and onboarding flow:

1. App-bar image assets flicker during route changes.
2. The code resend action wraps and relies on fixed dimensions instead of design padding.

No visual redesign, route behavior change, new dependency, or content animation is included.

## Architecture

`PrivatePageShell` becomes persistent application chrome owned by `RootRoute` and wraps the router `<Outlet />` inside the existing providers. Feature screens render only route-specific content. This is the standard root-layout pattern: route transitions replace outlet content without unmounting the app bar, footer, or their assets.

The document viewport does not scroll. `PrivatePageShell` fills one dynamic viewport and clips document overflow; its content and footer live in a dedicated internal vertical scroll container. The app bar is an absolute overlay within that stable shell, so it remains visually fixed without `position: fixed` or keyboard-specific JavaScript.

The content scroll container extends beneath the app bar. The existing translucent black background and backdrop blur therefore continue to show scrolled content behind the app bar and its safe-area portion.

## Components

- `RootRoute` owns one `PrivatePageShell` around `<Outlet />`.
- `AuthScreen` and `OnboardingScreen` stop rendering their own shell.
- Auth secondary buttons use intrinsic dimensions: horizontal and vertical padding plus `white-space: nowrap`; no fixed width or height.

The resend and “Use a different number” actions remain responsive and may wrap as whole buttons when the available row width is insufficient, but their text never wraps internally.

## Verification

- Route changes do not replace the app-bar DOM nodes.
- Header remains stationary while only the internal content container scrolls.
- Scrolled content remains visible behind the same dark blurred app-bar and safe-area backdrop.
- The document itself keeps `scrollY` at zero and does not horizontally overflow.
- Resend text stays on one line at 320, 375, and 390 CSS pixels.
- Existing auth/onboarding flow, warnings, tests, typecheck, lint, and production build remain green.
