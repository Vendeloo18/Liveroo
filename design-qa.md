# Vendeloo onboarding — tarjeta más baja y CTA SUBELOO — Design QA

- Source visual truth: the user's two screenshots from 2026-08-02 at 12:05:54 AM and 12:06:28 AM. macOS denied access to both temporary image paths, so their pixels could not be opened or measured in this pass. The prior 479 × 962 onboarding screenshot remains the last readable visual reference.
- Source pixels: unavailable for the two newest screenshots; prior reference was 479 × 962.
- Implementation route: `https://vendeloo.io/onboarding`, first and final steps.
- Intended viewport: 479 × 962 CSS px, DPR 1.
- Implementation screenshot: unavailable; the in-app browser connection returned no available browser.
- State: unauthenticated first step and final step before using SUBELOO.
- Density normalization: unavailable because neither the newest source captures nor an implementation capture could be opened.

## Full-view comparison evidence

The newest source screenshots could not be opened. From the user's scoped annotations, the intended change is to place the white sheet lower, replace the first CTA copy, move the SUBELOO control lower, and remove “Desliza” from its label. The implementation raises the orange hero to approximately 58dvh, reduces the white overlap from 24px to 16px, adds 14px above the SUBELOO control, changes the first CTA to “QUIERO MI $1”, and changes the slider label to “SUBELOO Y ACTIVA TU $1” for guests. A browser-rendered implementation capture is missing, so the resulting proportion cannot be visually compared yet.

## Required fidelity surfaces

- Fonts and typography: source uses the existing Vendeloo display and UI faces. Code preserves those tokens, but browser rendering and wrapping could not be inspected.
- Spacing and layout rhythm: the white sheet begins lower through a 58dvh orange hero and 8px less overlap. The slider receives 14px of additional separation from the increment controls. Visible overflow cannot be ruled out without the implementation screenshot.
- Colors and visual tokens: unchanged Vendeloo orange/white/ink tokens; visual sampling of the implementation is blocked.
- Image quality and asset fidelity: the existing generated headphone and product assets remain in use with `object-fit: contain`; the source assets themselves open correctly. Final browser crop and scale are unverified.
- Copy and content: the first CTA is now “QUIERO MI $1”. The final control says “SUBELOO Y ACTIVA TU $1” for guests or “SUBELOO Y GANA $1” for signed-in users; “Desliza” no longer appears inside that control.

## Focused region comparison

Blocked. The most important focused regions are the orange/white boundary on both steps and the final increment/slider/footer stack. Browser screenshots are required to confirm the new vertical placement, readable CTA copy, and absence of clipping.

## Interaction verification

- Automated backend test passed: the first authenticated claim credits exactly USD 1.
- A repeated claim returns `already_claimed` and leaves the balance unchanged at USD 1.
- Direct client writes to the wallet remain denied by Firestore rules.
- Guest-to-registration handoff and the visible drag interaction require browser testing.
- Browser console errors could not be checked.

## Findings

- [P2] The newest reference and browser-rendered implementation cannot be compared.
  - Location: `/onboarding`, first and final steps at 479 × 962.
  - Evidence: macOS denies access to the two newest temporary screenshots and no browser backend is connected.
  - Impact: the new orange/white proportion, slider position, text wrapping, and footer visibility cannot be signed off visually.
  - Fix: capture the deployed first and final steps at 479 × 962 and compare them with accessible copies of the user's screenshots.

## Comparison history

- Iteration 1: code measurements reduced the white sheet and consolidated the flow from three slides to two. No post-fix visual evidence was available because no browser backend was connected.
- Iteration 2: the orange hero was increased from 52dvh to 58dvh, sheet overlap reduced from 24px to 16px, the SUBELOO control moved 14px lower, and both requested CTA labels were shortened. Post-fix visual evidence remains unavailable for the same browser and file-access blockers.

## Implementation checklist

- Capture the first and final onboarding steps at the target viewport.
- Test forward navigation, back navigation, guest registration handoff, and the SUBELOO drag.
- Check console errors and confirm the wallet displays “Bono de bienvenida”.
- Re-run the visual comparison and resolve any P0/P1/P2 findings.

final result: blocked
