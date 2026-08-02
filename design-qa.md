# Vendeloo — onboarding 80/20 + SUBELOO — Design QA

- Source visual truth:
  - Current conversation attachments, 2026-08-02: oversized white first-step sheet and the price/increment controls to remove.
  - Browser capture before this iteration: `/tmp/vendeloo-design-qa/onboarding-before.png`.
- Rendered implementation:
  - `/tmp/vendeloo-design-qa/onboarding-step1-final.png`
  - `/tmp/vendeloo-design-qa/onboarding-step2-final.png`
  - `/tmp/vendeloo-design-qa/onboarding-step2-success-final.png`
- Production route: `https://vendeloo.io/onboarding`
- Viewport: browser 556 × 964 CSS px; centered app 480 × 964 CSS px; deviceScaleFactor 1.
- Source attachment: approximately 489 × 965 px. Browser before/after captures use identical 556 × 964 viewports and 480px app frames, so the layout comparison is 1:1 inside the app region.
- States: step 1, step 2 ready, and step 2 successful reward.

## Findings

No actionable P0, P1, or P2 visual differences remain for the requested change.

- [P3] The controlled Browser reports Firebase App Check/Firestore connectivity warnings.
  - Location: shared Firebase initialization, outside the onboarding presentation layer.
  - Evidence: App Check returned a reCAPTCHA 403 in the controlled Browser and Firestore temporarily entered offline mode.
  - Impact: the guest onboarding, pending bonus, green success state, confetti, and login handoff work; an authenticated server-side bonus claim could not be verified in this browser session.
  - Follow-up: verify one authenticated claim in a normal user browser when testing backend/App Check configuration.

## Full-view comparison evidence

The before and after first-step captures were emitted together at the same viewport. Before, the white sheet measured 334.125px of a 964px viewport (34.6%). After, it measures 192.797px and begins at y=771.187px: exactly 20% of the viewport, with no vertical overflow. The hero now occupies the remaining 80% while keeping the original product art full bleed and the headline readable.

Step 2 uses the same 80/20 structure. The former price card and `$1/$5/$10` increment selector are gone. The sheet now contains one short welcome-bonus explanation, one SUBELOO slider, its helper text, Back, and the shared mantra.

## Focused interaction comparison

The ready and completed step-2 captures were emitted together. The ready state shows a single orange SUBELOO control. Completing it produces all three required signals in the same state:

- green track (`rgb(46, 158, 69)` in the final production capture);
- visible canvas confetti using Vendeloo orange, white, and green;
- label `¡TE GANASTE $1!`.

The guest flow then explains `Crea tu cuenta para usar tu $1` and routes to `/login?crear=1&bonus=1`, preserving the pending, non-withdrawable welcome bonus behavior.

## Required fidelity surfaces

- Fonts and typography: computed styles on onboarding and Home expose exactly two families: Anton for the wordmark and campaign headlines, Archivo for all UI, body, labels, controls, prices, metadata, navigation, admin, and mobile. Onboarding UI weights were consolidated to 600/700/800; no third visible typeface is loaded.
- Spacing and layout rhythm: both onboarding steps measure 80% orange / 20% white at 556 × 964, with the same 26px sheet radius, 16px overlap, 22px horizontal inset, progress line, and bottom alignment. `scrollHeight` equals the 964px viewport.
- Colors and visual tokens: the flow uses existing Vendeloo orange, white, ink, tint, and success-green tokens. No new competing palette was introduced.
- Image quality and asset fidelity: both existing product compositions remain high-resolution, full bleed, and uncropped enough to preserve the principal products at the measured viewport.
- Copy and content: MIRALOO, SUBELOO, RECIBELOO remain consistent. Step 2 explicitly states that the USD 1 is for participating and cannot be withdrawn.

## Interaction verification

- CONTINUAR opens step 2.
- Atrás remains visible and enabled before completion.
- SUBELOO works from the slider keyboard action; pointer/touch logic remains in the shared component.
- Success state becomes green, creates confetti, and reads `¡TE GANASTE $1!`.
- Guest success creates the pending bonus marker and routes to account creation.
- TypeScript check passed.
- Production build passed.
- Production deployment is Ready and the route returns successfully.
- Console reviewed; only the Firebase environment warnings described above were observed.

## Comparison history

- Iteration 1: source capture showed a 34.6% white sheet and too much empty vertical space.
- Iteration 2: compacted the process strip, removed its descriptions, simplified the reward step, and reduced the sheet to 210px. Browser verification showed 21.7%, still above the explicit target.
- Iteration 3: compensated for the 16px overlap and set the final sheet to 192.797px of 964px. Browser verification confirms the requested 20.0% with no overflow.
- Interaction iteration: fixed the inline custom-property override that prevented the completed slider from becoming green, then verified the final green, confetti, and reward-message state in production.

## Implementation checklist

- [x] Remove price and increment controls.
- [x] Use one SUBELOO slider.
- [x] Show green success, confetti, and `¡TE GANASTE $1!`.
- [x] Keep bonus restricted to participation and non-withdrawable.
- [x] Set both onboarding screens to an 80/20 composition.
- [x] Verify only Anton and Archivo are rendered.
- [x] Capture and compare production before/after at the same viewport.

final result: passed
