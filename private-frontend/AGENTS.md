# Repository Guide

## Goal

Keep this frontend small and build only from verified product requirements. Do
not invent APIs, product behavior, dependencies, or infrastructure.

## Stack

- Vite, React, and strict TypeScript.
- pnpm 11.
- TanStack Router with file-based routes.
- Tailwind CSS v4.
- Client-rendered, mobile-first PWA target.

Add data, state, form, auth, component, and test libraries only when a real
requirement needs them.

## Source structure

```text
src/
├── app/       # bootstrap, routes, providers, composition
├── features/  # product capabilities
└── shared/    # domain-neutral code with real reuse
```

- Dependencies flow `app -> features -> shared`.
- `shared` imports neither `features` nor `app`.
- Features may import `shared`, never `app` or another feature.
- Compose features in `app`; do not move feature behavior into `shared`.
- Create directories and abstractions only when they have a current use.
- Routes live in `src/app/routes`.
- `src/app/routeTree.gen.ts` is generated. Never edit or lint it manually.

## Code rules

- Use function components and hooks.
- Keep strict TypeScript. Do not add unjustified `any`, `@ts-ignore`, or unsafe
  assertions.
- Keep side effects out of render and clean them up when ownership ends.
- Components render state and emit intent. Put external I/O and response parsing
  behind feature-owned boundaries.
- Validate untrusted external data before it reaches UI or domain logic.
- Preserve the meaning of missing and nullable data. `null`, an absent field,
  zero, and an empty string are different states. Never replace unknown data with
  invented numbers, dates, strings, or other convenient fallbacks.
- Use a fallback only when the product or API contract explicitly defines it and
  its meaning is safe. Otherwise keep an explicit unavailable/unknown state and
  exclude the value from calculations.
- Handle expected request failures in the owning feature. Use route boundaries
  for unexpected render failures. Never expose raw external errors to users.
- Data-backed UI distinguishes loading, success, empty, and error states that
  actually apply.
- Client-side checks do not grant authorization, and client code contains no
  secrets.
- Build mobile-first, support 320 CSS pixels, and keep keyboard and focus
  behavior usable.
- Treat mobile browsers and embedded WebViews as primary environments. Opening
  the virtual keyboard must not create document-level horizontal scrolling or
  move the page into empty space.
- Keep root, flex, grid, modal, and third-party embed containers shrinkable with
  `min-width: 0` and bounded by the viewport. Avoid `100vw` and fixed minimum
  widths for page layout.
- Use dynamic viewport units for full-height screens. Mobile form controls must
  not trigger browser zoom, and focused fields must remain visible while the
  keyboard is open.
- Verify form and embedded flows on real mobile browsers or WebViews with the
  keyboard open, not only in a resized desktop browser.
- Use Tailwind utilities for product UI; keep global CSS minimal.
- Use the shared `Skeleton` component as the visual source of truth for
  loading placeholders. Callers may set geometry, positioning, and responsive
  bounds, but must not override its color, animation, or border radius.
  Shape-specific radius overrides are allowed only when the placeholder mirrors
  an explicitly round final element, such as an avatar or card.

## Working rules

- Inspect existing code before changing it.
- Make the smallest coherent change and avoid speculative flexibility.
- Do not add or replace dependencies without approval.
- Preserve unrelated user changes.
- Ask when a missing decision changes product behavior, security, public API, or
  data ownership.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

Run the relevant checks for each change and report exactly what passed.
