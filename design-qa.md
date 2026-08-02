# Vendeloo — login + dos onboarding en una sola campaña — Design QA

- Source visual truth:
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_CS2Ppd/Screenshot 2026-08-02 at 12.25.11 AM.png`
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_nMHnCq/Screenshot 2026-08-02 at 12.25.20 AM.png`
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_ijQbwk/Screenshot 2026-08-02 at 12.25.42 AM.png`
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_J46NMG/Screenshot 2026-08-02 at 12.25.57 AM.png`
- Source inspection: the login hero, first onboarding, final onboarding, and account form were opened and inspected in macOS Preview. Direct file reads remain blocked, so exact source pixel dimensions are unavailable.
- Intended implementation flow: one `/login` page followed by exactly two `/onboarding` states.
- Intended viewport: 479 × 962 CSS px, DPR 1, based on the prior readable Vendeloo mobile capture.
- Implementation screenshot: unavailable; the in-app browser runtime has no connected browser.
- State: unauthenticated login/create-account, onboarding step 1, and onboarding step 2 before using SUBELOO.
- Density normalization: blocked because exact source pixels and a browser implementation capture are unavailable.

## Full-view comparison evidence

The four source captures expose four different visual systems: the login hero uses a large product and a white process sheet; onboarding step 1 uses a different headline scale and product crop; onboarding step 2 uses a denser bidding panel; the account form abandons the product image and becomes a separate orange/form-card composition. This makes one continuous acquisition journey feel like four unrelated slides.

The implementation removes the separate login hero/form sequence. `/login` is now one page with the account mode switch and form integrated into the same shared hero/sheet structure used by onboarding. A shared `BrandFlowHero` component now owns logo position, header action, hero height, product scale, headline type, eyebrow, description, and image treatment for all three screens. Both onboarding states remain in one route with `TOTAL = 2`.

## Required fidelity surfaces

- Fonts and typography: all three screens now share one display-title range, line height, eyebrow tracking, description size, and button hierarchy. Browser wrapping remains unverified.
- Spacing and layout rhythm: all three use a 58dvh hero, the same 26px white-sheet curve, the same 16px overlap, the same 22px horizontal inset, and the same header/copy coordinates. Final overflow and fold placement remain unverified.
- Colors and visual tokens: all screens use the existing Vendeloo orange, white, ink, accent, surface, line, radius, and button tokens. The old separate auth background/card language was removed.
- Image quality and asset fidelity: login and onboarding step 2 use the same supplied vertical headphone campaign asset. Onboarding step 1 retains the supplied product collage. No placeholder or generated substitute was introduced. Browser crops remain unverified.
- Copy and content: the journey is now one login page plus two clearly labeled steps: “Paso 1 de 2 · Descubre” and “Paso 2 de 2 · Participa”. MIRALOO, SUBELOO, RECIBELOO, and the USD 1 welcome bonus remain intact.

## Focused region comparison

The four source screens were individually inspected. Their hero headers, image crops, headline blocks, white-sheet starts, button styles, and form treatment were compared visually. A post-fix implementation capture is unavailable, so a true combined source/implementation comparison cannot be produced.

## Interaction verification

- TypeScript check passed.
- Production build passed.
- Login mode switches between create account and sign in on the same page.
- Email/password, Google authentication, welcome-bonus continuation, guest exploration, and “Ver cómo funciona” routes remain wired.
- Onboarding remains exactly two steps; forward, back, increment selection, SUBELOO drag, and the one-time bonus logic remain wired.
- Browser interaction and console checks are blocked because no in-app browser backend is connected.

## Findings

- [P2] Shared hero crops are not browser-verified.
  - Location: `/login` and both `/onboarding` states at 479 × 962.
  - Evidence: source screenshots are visible in Preview; implementation screenshot is unavailable.
  - Impact: the vertical headphones or first product collage may overlap a headline or crop too tightly on some heights.
  - Fix: capture all three screens at 479 × 962 and tune only the shared hero object positions if needed.

- [P2] Integrated login-sheet height is not browser-verified.
  - Location: `/login`, create-account mode at 360px and 479px widths.
  - Evidence: build succeeds, but no rendered screenshot is available.
  - Impact: the form may require more scrolling than intended or place the primary CTA below the expected fold.
  - Fix: capture create-account and sign-in modes at the target widths and tighten vertical gaps if the CTA falls too low.

## Comparison history

- Iteration 1: reduced onboarding to two steps and introduced the welcome bonus. Browser evidence unavailable.
- Iteration 2: enlarged the product imagery and simplified the offer explanation. Browser evidence unavailable.
- Iteration 3: inspected all four source states, identified the duplicate login hero/form sequence and inconsistent layout systems, replaced them with one login page, and created a shared hero/sheet grammar for login plus two onboarding states. Post-fix browser evidence remains unavailable.

## Implementation checklist

- Capture login create-account, login sign-in, onboarding step 1, and onboarding step 2 at 479 × 962.
- Verify shared hero height, logo/action alignment, headline wrapping, image crops, white-sheet boundary, and primary CTA fold position.
- Test authentication modes, Google, email validation, forward/back onboarding, increment controls, SUBELOO, and bonus continuation.
- Check console errors and resolve any visible P0/P1/P2 issue before visual sign-off.

final result: blocked
