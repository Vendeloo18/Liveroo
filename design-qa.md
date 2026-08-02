# Vendeloo onboarding compacto + bono — Design QA

- Source visual truth: `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_da2eHM/Screenshot 2026-08-01 at 11.44.12 PM.png`
- Source pixels: 479 × 962.
- Implementation route: `http://localhost:3000/onboarding`, segundo y último paso.
- Intended viewport: 479 × 962 CSS px, DPR 1.
- Implementation screenshot: unavailable; the in-app browser connection returned no available browser.
- State: unauthenticated final onboarding step, before dragging SUBELOO.
- Density normalization: source is treated as DPR 1; implementation density could not be measured without a browser capture.

## Full-view comparison evidence

The source screenshot was opened successfully. It shows the orange hero ending near 38% of the viewport and a white sheet occupying the remaining area. The requested implementation raises the orange hero to approximately 52dvh, reduces the progress/content/footer gaps, and removes the middle slide. A browser-rendered implementation capture is missing, so the resulting proportion cannot be visually compared yet.

## Required fidelity surfaces

- Fonts and typography: source uses the existing Vendeloo display and UI faces. Code preserves those tokens, but browser rendering and wrapping could not be inspected.
- Spacing and layout rhythm: the white sheet is intentionally reduced through a taller orange hero and more compact product, price, increment, helper, and footer blocks. Visible overflow cannot be ruled out without the implementation screenshot.
- Colors and visual tokens: unchanged Vendeloo orange/white/ink tokens; visual sampling of the implementation is blocked.
- Image quality and asset fidelity: the existing generated headphone and product assets remain in use with `object-fit: contain`; the source assets themselves open correctly. Final browser crop and scale are unverified.
- Copy and content: the flow now has two steps and the final step explicitly promises a one-time, non-withdrawable USD 1 welcome credit for SUBELOO.

## Focused region comparison

Blocked. The most important focused region is the compact white sheet containing the product card, price, increments, slider, helper text, and footer. A browser screenshot is required to confirm that the reduced vertical dimensions preserve readability and do not clip the footer.

## Interaction verification

- Automated backend test passed: the first authenticated claim credits exactly USD 1.
- A repeated claim returns `already_claimed` and leaves the balance unchanged at USD 1.
- Direct client writes to the wallet remain denied by Firestore rules.
- Guest-to-registration handoff and the visible drag interaction require browser testing.
- Browser console errors could not be checked.

## Findings

- [P2] Browser-rendered compact layout is not captured.
  - Location: `/onboarding`, final step at 479 × 962.
  - Evidence: source screenshot is available; implementation screenshot is unavailable.
  - Impact: footer clipping, text wrapping, and the final orange/white proportion cannot be signed off visually.
  - Fix: capture the deployed or local final step at 479 × 962 and compare it with the source screenshot.

## Comparison history

- Iteration 1: code measurements reduced the white sheet and consolidated the flow from three slides to two. No post-fix visual evidence is available because no browser backend is connected.

## Implementation checklist

- Capture the first and final onboarding steps at the target viewport.
- Test forward navigation, back navigation, guest registration handoff, and the SUBELOO drag.
- Check console errors and confirm the wallet displays “Bono de bienvenida”.
- Re-run the visual comparison and resolve any P0/P1/P2 findings.

final result: blocked
