# Auth Screen Redesign

## Goal

Replace the existing credit-card application screen with the authentication screen from Figma node `233:10978`, remove obsolete UI and assets, and make the new primary button the reusable UI-kit primary action.

## Source of truth

- Figma file: `DGxkBFVzZRrJub2k8Slyhg` (`Partner Portal`)
- Figma node: `233:10978`
- Target natural viewport: `375 × 812` CSS pixels
- The Figma screen is the visual source of truth. Browser chrome and the illustrated iOS status bar shown in Figma are not application UI and must not be rendered by the app.

## Confirmed product decisions

- Replace the current screen completely rather than restyling its existing credit-card flow.
- Keep the navigation bar fixed while the document scrolls.
- The phone number input starts empty and has no example value.
- The country control displays the UAE flag and `+971`.
- The country control has press feedback but no selection behavior yet.
- The Continue action has press feedback but no backend or navigation behavior in this scope.
- No content entrance animations.
- Do not add a test runner or other dependency for this visual-only redesign. Verification uses the existing static checks plus browser comparison.

## Visual design

The page uses a solid black background and a mobile-first content column capped at `375px`. On wider desktop viewports the column is centered without scaling. The page supports the device safe areas and keeps the document horizontally bounded.

The fixed navigation area begins below the top safe area. It is `66px` high, uses a translucent `rgba(0, 0, 0, 0.82)` surface, `7px` backdrop blur, and a `#1c1c1c` bottom border. It contains the XPlace wordmark and PRIVATE label on the left, plus the EN and WhatsApp controls on the right. Controls retain the shared button press feedback and cannot select or drag their text or images.

The form content uses `16px` horizontal padding and `40px` vertical padding. Its copy is:

- Eyebrow: `XPLACE PRIVATE`
- Heading: `Apply or sign in`
- Description: `Enter your mobile number and we send a six-digit code on WhatsApp.`

The phone row consists of a non-functional UAE country control and an empty telephone input. Both use only a `#1c1c1c` bottom border. The country control and input remain shrinkable at `320px` viewport width and the input uses at least `16px` text on mobile to avoid focus zoom.

The primary button is full width and `48px` high with a white background and border. Its label is black Helvetica Neue Bold, `12px`, uppercase, with `2px` letter spacing. Its pressed state uses the existing deliberate press duration and subtle scale feedback; there is no entrance animation.

The footer is separated by a `#1c1c1c` top border. It contains the Agreement and Privacy labels followed by the legal copy from Figma:

`Pontech Group L.L.C-FZ, Meydan Free Zone, Dubai. XPlace is a financial technology company and is not a bank. Cards are issued by our licensed issuing partner pursuant to a licence from Visa.`

Agreement and Privacy are visual labels in this scope because no destinations were supplied. They must not invent routes or URLs.

## Typography and assets

The new design uses Helvetica Neue rather than Inter. Helvetica Neue is proprietary and the Figma response does not provide font files, so the app must not download or commit an unlicensed copy. Use the system stack `"Helvetica Neue", Helvetica, Arial, sans-serif`; it renders the exact family on Apple devices and a safe sans-serif fallback elsewhere. Required weights are Light `300`, Regular `400`, and Bold `700`.

Download and commit the exact XPlace logo, globe, WhatsApp, and country-chevron assets returned by the Figma MCP response. The UAE flag is represented by the flag emoji in the Figma source and is rendered as a single item, not reconstructed from multiple shapes.

## Component structure

- `AuthScreen` composes the fixed navigation, form, and footer within the mobile page shell.
- `AuthNavBar` owns the fixed navigation layout only. The old scroll-progress gradient and credit-card-specific app-bar behavior are removed.
- `AuthForm` owns the copy, phone control, empty input, and Continue action.
- `AuthFooter` owns the agreement/privacy labels and legal text.
- `Button` remains the domain-neutral interaction primitive. It gains a reusable primary presentation rather than embedding the new primary styles in the auth feature.

The feature imports shared UI components; shared code does not import the auth feature.

## Removal scope

Remove the obsolete credit-card hero, card image, benefits list, membership disclaimer, section divider, decorative background, US flag, info icon, check icons, old brand fragments, and scroll-driven app-bar implementation. Delete an asset only after confirming no remaining source reference exists.

Keep global PWA behavior, safe-area handling, zoom prevention, routing, and unknown-route redirect behavior unless the new layout requires a direct adjustment.

## Interaction and accessibility

- The phone field uses `type="tel"`, `inputMode="tel"`, and `autoComplete="tel"`.
- The fixed navigation remains visible during scroll and does not move when the phone input is focused.
- Controls have descriptive accessible names and keyboard-visible focus treatment.
- Country, language, WhatsApp, and Continue controls do not invent unavailable product behavior.
- Button contents remain non-selectable and image dragging remains disabled.
- The screen remains usable at `320px` width and when the mobile keyboard is open.

## Verification

- Run `pnpm typecheck`.
- Run `pnpm lint`.
- Run `pnpm build`.
- Run `git diff --check`.
- Compare the implementation and Figma screenshot at a `375 × 812` viewport.
- Inspect `320px` width for overflow.
- Inspect a desktop viewport to confirm the mobile column is centered and remains `375px` wide.
- Verify the fixed navigation after scrolling.
- Verify the phone input starts empty and the country control remains non-functional while preserving press feedback.
