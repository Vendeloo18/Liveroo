# Vendeloo onboarding — producto protagonista — Design QA

- Source visual truth 1: `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_D53e6P/Screenshot 2026-08-02 at 12.13.43 AM.png`.
- Source visual truth 2: `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/TemporaryItems/NSIRD_screencaptureui_uQRZse/Screenshot 2026-08-02 at 12.14.38 AM.png`.
- Source inspection: both references were opened successfully in macOS Preview. Direct file reads remain blocked, so exact source pixel dimensions are unavailable. The second reference is a portrait mobile onboarding composition; 479 × 962 CSS px remains the intended comparison viewport from the preceding Vendeloo capture.
- Implementation route: `https://vendeloo.io/onboarding`, first and final steps.
- Implementation screenshot: unavailable; the in-app browser connection reports no available browser.
- State: unauthenticated first step and unauthenticated final step before using SUBELOO.
- Density normalization: blocked because exact source pixels and a browser implementation capture are unavailable.

## Full-view comparison evidence

The second reference shows the intended hierarchy: a large orange hero, an oversized product image that fills the lower hero, a bold headline layered above it, then a clean white process section. The previous Vendeloo implementation used a small bordered product card occupying roughly half the hero width. The code now removes that card treatment, makes each hero asset full-width and 72–76% of the hero height, uses `object-fit: cover`, expands the headline block to 92%, and removes the duplicated mini product card from the first white section.

The first reference isolates the unclear offer control: “PRECIO ACTUAL”, “TU OFERTA”, and three unlabeled `+$` choices. The implementation now presents a directional explanation — “AHORA VA EN $4 → CON +$1 OFRECES $5” — adds the instruction “ELIGE CUÁNTO QUIERES SUBIR”, and labels every choice `SUBIR $1`, `SUBIR $5`, or `SUBIR $10`.

## Required fidelity surfaces

- Fonts and typography: the existing Vendeloo display and UI type tokens are preserved. The headline grows to a 2.7–3.75rem responsive range to match the reference hierarchy. Browser wrapping and optical weight remain unverified.
- Spacing and layout rhythm: the orange/white boundary stays at the previously requested lower position. Product imagery now fills the lower 72–76% of the hero, and the first white section is simplified by removing the duplicated live-product card. Final vertical overflow and footer visibility remain unverified.
- Colors and visual tokens: the Vendeloo orange, white, ink, accent, radii, and button tokens are unchanged. The supplied orange product assets become the hero surface without a border, shadow, or rounded card.
- Image quality and asset fidelity: the supplied 1254 × 1254 product collage and 1536 × 1024 headphone asset are used directly with no generated placeholders. Their intended full-bleed crop cannot be signed off without a browser capture.
- Copy and content: the offer explanation is now explicit and directional. The two-step MIRALOO/SUBELOO/RECIBELOO flow and the one-time USD 1 bonus behavior are preserved.

## Focused region comparison

The source focused region was opened and inspected: it contains the old price and increment control. The implementation code replaces the separator with a Phosphor arrow and adds explicit labels. A post-fix browser image of the same region is unavailable, so text fit and visual balance cannot be compared.

## Interaction verification

- TypeScript check passed.
- Production build passed.
- Increment buttons still update the displayed offer through the existing `inc` state.
- SUBELOO drag, bonus claim, back navigation, and guest registration behavior are unchanged by this visual pass.
- Browser interaction and console checks are blocked because no in-app browser backend is connected.

## Findings

- [P2] Full-bleed product crops are not visually verified.
  - Location: `/onboarding`, both orange heroes at 479 × 962.
  - Evidence: both source references were visible in Preview, but no implementation screenshot is available.
  - Impact: the products could crop too tightly or overlap important copy at some mobile heights.
  - Fix: capture both deployed steps at 479 × 962 and compare them with the second reference.

- [P2] Simplified offer explanation is not visually verified.
  - Location: final-step price and increment controls.
  - Evidence: source crop is available; post-fix implementation crop is unavailable.
  - Impact: the longer dynamic label could wrap at narrow widths.
  - Fix: capture the final step at 360px and 479px widths, confirm the arrow and labels remain on one readable line, then tighten the copy if needed.

## Comparison history

- Iteration 1: reduced the white region and consolidated onboarding to two steps. Browser evidence unavailable.
- Iteration 2: lowered the white sheet further and shortened the CTAs. Browser evidence unavailable.
- Iteration 3: opened the two newest references in Preview, removed the small hero cards, converted both product assets to full-width hero images, removed the duplicated first-step mini product, and rewrote the final offer explanation. Post-fix browser evidence remains unavailable.

## Implementation checklist

- Capture first and final onboarding steps at 479 × 962.
- Capture the final offer control at 360px width.
- Verify headline/product overlap, product crop, white-sheet boundary, copy wrapping, and footer visibility.
- Test forward, back, increment, SUBELOO, and guest registration interactions; check console errors.
- Resolve any visible P0/P1/P2 findings and repeat the comparison.

final result: blocked
