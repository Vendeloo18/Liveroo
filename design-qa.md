# Vendeloo — dos onboarding + tipografía unificada — Design QA

- Source visual truth:
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_Av3LyG/Screenshot 2026-08-02 at 12.42.20 AM.png`
  - `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_JLH3QU/Screenshot 2026-08-02 at 12.42.52 AM.png`
- Source inspection: both screenshots were opened and inspected in macOS Preview during this run.
- Intended implementation flow: keep `/login` unchanged and revise the two `/onboarding` states only.
- Intended viewport: mobile web, approximately 479 × 962 CSS px based on the supplied captures.
- Implementation screenshot: unavailable; browser discovery returned no connected in-app or external browser.
- State: onboarding step 1 before continuing and step 2 before using SUBELOO.
- Density normalization: blocked because an implementation screenshot at the same viewport is unavailable.

## Full-view comparison evidence

The supplied step 1 capture shows the white “MIRALOO. DESCUBRE.” title crossing the white/orange shoe, which weakens legibility. The supplied step 2 capture repeats the same headphones already used on the login screen and makes the acquisition flow feel less varied.

The code now keeps step 1's existing shoe, phone, and controller but moves/scales the artwork down and right, narrows the copy column, and strengthens the text shadow. Step 2 now uses a new Vendeloo-orange product composition containing a handheld console, instant camera, and smartwatch, with deliberate empty orange space for the headline. The same new image is reused in the practice-product card so the hero and action panel describe the same item.

## Required fidelity surfaces

- Fonts and typography: the product now exposes only two visible families. Anton is reserved for campaign headlines and primary display figures; Archivo is used for body text, controls, metadata, counters, and tabular figures on web and mobile. The former JetBrains Mono runtime font was removed from both roots. Browser wrapping remains unverified.
- Spacing and layout rhythm: login was not edited. Both onboarding states preserve the shared 58dvh hero, 26px white-sheet radius, 16px overlap, 22px horizontal inset, progress treatment, and CTA hierarchy. Step 1 copy is intentionally narrower to protect legibility.
- Colors and visual tokens: the new image and all UI retain Vendeloo orange, white, black, the existing surface tokens, radii, and shadows.
- Image quality and asset fidelity: step 1 retains the supplied original product collage. Step 2 uses the generated 1254 × 1254 PNG `apps/web/public/brand/onboarding-productos-live-v3.png`, with no logos, text, watermark, or placeholder art. Browser crop remains unverified.
- Copy and content: the journey remains exactly two steps and keeps MIRALOO, SUBELOO, RECIBELOO, the practice increment selector, and the one-time USD 1 welcome bonus.

## Focused region comparison

The title/product collision in step 1 and the repeated-headphone hero in step 2 were inspected directly from the two Preview windows. A valid post-fix combined comparison cannot be produced without a browser-rendered implementation capture at the same viewport.

## Interaction verification

- Web TypeScript check passed.
- Mobile TypeScript check passed.
- Web production build passed.
- Login source was not modified.
- Onboarding remains exactly two steps; forward, back, increment selection, SUBELOO drag, and one-time bonus wiring remain intact.
- Browser interaction and console checks are blocked because no browser backend is connected.

## Findings

- [P2] Revised hero crops are not browser-verified.
  - Location: both `/onboarding` states around 479 × 962.
  - Evidence: source screenshots and raster assets are visible; a rendered implementation screenshot is unavailable.
  - Impact: the revised step 1 artwork offset or the new step 2 product group may still need a small object-position adjustment on a real device.
  - Fix: capture both steps at the supplied viewport, place source and implementation in one comparison image, and tune only the two hero positions if necessary.

- [P2] Final headline wrapping is not browser-verified.
  - Location: “MIRALOO. DESCUBRE.” and “SUBELOO. RECIBELOO.”
  - Evidence: CSS and type checks pass, but no browser screenshot is available.
  - Impact: a narrow device could wrap a display word differently than intended.
  - Fix: verify at 360px and 479px widths and adjust the step-specific display size only if wrapping changes.

## Comparison history

- Iteration 1: source captures exposed two P1 visual issues: product repetition and title/product collision.
- Iteration 2: added the new three-product hero, matched its thumbnail and copy, moved the first product image away from the copy, and standardized typography from three families to two across web and mobile.
- Post-fix visual evidence: blocked because the browser runtime has no available browser.

## Implementation checklist

- Capture onboarding steps 1 and 2 at 479 × 962 and 360px width.
- Compare each source and implementation together at matched scale.
- Verify headline wrapping, product crop, white-sheet boundary, CTA fold position, and console errors.
- Keep `/login` visually unchanged.

final result: blocked
