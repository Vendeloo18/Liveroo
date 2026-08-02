# Vendeloo — fondo del onboarding + sistema visual global — Design QA

- Source visual truth:
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_shHCVA/Screenshot 2026-08-02 at 12.56.58 AM.png`
- Source inspection: the screenshot was opened and inspected in macOS Preview during this run.
- Intended implementation flow: restore the continuous first-onboarding background, keep `/login` structurally unchanged, and standardize the app's shared typography, headers, logo scale, colors, cards, and controls.
- Intended viewport: mobile web, approximately 479 × 962 CSS px based on the supplied captures.
- Implementation screenshot: unavailable; browser discovery returned no connected in-app or external browser.
- State: onboarding step 1 before continuing and step 2 before using SUBELOO.
- Density normalization: blocked because an implementation screenshot at the same viewport is unavailable.

## Full-view comparison evidence

The supplied step 1 capture shows a flat orange strip behind the logo and copy, followed by a hard horizontal seam where the product photo begins. The discontinuity makes the hero look assembled from two unrelated blocks.

The code now renders step 1's original shoe, phone, and controller artwork full bleed with no translated or scaled transform, eliminating the exposed parent background that created the seam. The narrower copy column and stronger text shadow remain for legibility. The wider visual pass also routes page titles, prices, cards, forms, counters, admin data, and mobile UI through Archivo; Anton remains only for campaign headlines and the Vendeloo wordmark.

## Required fidelity surfaces

- Fonts and typography: the product now exposes only two visible families. Anton is reserved for campaign headlines and the wordmark; Archivo is used for page titles, prices, body text, controls, metadata, counters, admin, and tabular figures on web and mobile. The former JetBrains Mono dependency was removed. Browser wrapping remains unverified.
- Spacing and layout rhythm: login was not edited. Both onboarding states preserve the shared 58dvh hero, 26px white-sheet radius, 16px overlap, 22px horizontal inset, progress treatment, and CTA hierarchy. Step 1 copy is intentionally narrower to protect legibility.
- Colors and visual tokens: the new image and all UI retain Vendeloo orange, white, black, the existing surface tokens, radii, and shadows.
- Image quality and asset fidelity: step 1 retains the supplied original product collage at its natural full-bleed crop and step 2 retains the existing 1254 × 1254 product composition. Browser crop remains unverified.
- Copy and content: the journey remains exactly two steps and keeps MIRALOO, SUBELOO, RECIBELOO, the practice increment selector, and the one-time USD 1 welcome bonus.

## Focused region comparison

The flat orange band and horizontal image seam were inspected directly in Preview. A valid post-fix combined comparison cannot be produced without a browser-rendered implementation capture at the same viewport.

## Interaction verification

- Web TypeScript check passed.
- Mobile TypeScript check passed.
- Web production build passed.
- Login structure and content were not modified; it inherits only the shared typographic system.
- Onboarding remains exactly two steps; forward, back, increment selection, SUBELOO drag, and one-time bonus wiring remain intact.
- Browser interaction and console checks are blocked because no browser backend is connected.

## Findings

- [P2] Restored hero crop is not browser-verified.
  - Location: first `/onboarding` state around 479 × 962.
  - Evidence: source screenshots and raster assets are visible; a rendered implementation screenshot is unavailable.
  - Impact: the full-bleed product group may still need a small object-position adjustment on a real device.
  - Fix: capture the first step at the supplied viewport, place source and implementation in one comparison image, and tune only object-position if necessary.

- [P2] Final headline wrapping is not browser-verified.
  - Location: “MIRALOO. DESCUBRE.” and “SUBELOO. RECIBELOO.”
  - Evidence: CSS and type checks pass, but no browser screenshot is available.
  - Impact: a narrow device could wrap a display word differently than intended.
  - Fix: verify at 360px and 479px widths and adjust the step-specific display size only if wrapping changes.

## Comparison history

- Iteration 1: prior source captures exposed product repetition and title/product collision; the two-step flow and varied product art were implemented.
- Iteration 2: the current source capture exposed a new flat-orange band caused by the first hero image transform.
- Iteration 3: removed that transform, restored the original seamless background, standardized the main logo to 29px, and restricted the visible typography system to Anton plus Archivo across web, mobile, and admin.
- Post-fix visual evidence: blocked because the browser runtime has no available browser.

## Implementation checklist

- Capture onboarding steps 1 and 2 at 479 × 962 and 360px width.
- Compare each source and implementation together at matched scale.
- Verify headline wrapping, seamless product crop, white-sheet boundary, CTA fold position, shared page headers, and console errors.
- Keep `/login` visually unchanged.

final result: blocked
