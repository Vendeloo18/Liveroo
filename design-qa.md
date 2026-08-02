# Vendeloo entry redesign — Design QA

- Source visual truth: `/var/folders/x2/sj4sg1214x1csl50fnn985h00000gn/T/codex-clipboard-b2673d30-fb29-4646-a701-f7ed1632dd21.png`
- Implementation screenshot: `/Users/adammanir/Documents/VENDELOO/docs/design-qa/ventas-en-vivo-login.png`
- Combined comparison evidence: `/Users/adammanir/Documents/VENDELOO/docs/design-qa/ventas-en-vivo-comparison.png`
- Route and state: `http://localhost:3000/login`, unauthenticated entry hero
- Intended viewport: 390 × 844 CSS px
- Browser content capture: 375 × 812 CSS px at DPR 1 (the in-app browser reserved 15 × 32 px for its own chrome)
- Source pixels: 853 × 1844; normalized to 375 × 812 in the combined comparison
- Implementation pixels: 375 × 812; no density resampling

## Full-view comparison evidence

The combined comparison confirms the same main composition: vivid orange product-led upper region, white guided lower sheet, condensed all-caps headline, live-price panel, three-step explanation, orange primary CTA, outlined returning-user CTA, onboarding action, and guest entry. The implementation keeps the subject, crop, hierarchy, rounded forms, and orange/white balance of the selected reference.

## Required fidelity surfaces

- Fonts and typography: Anton remains the display face and Archivo the UI face. The headline has the same compact line height and three-line wrap. CTA and helper copy remain readable at the captured mobile width.
- Spacing and layout rhythm: The hero-to-sheet split, 22 px outer margins, three equal steps, and stacked pill actions match the reference's rhythm. The post-fix capture keeps every CTA inside the initial mobile viewport.
- Colors and visual tokens: Brand orange, white surfaces, warm orange tints, dark product contrast, and accessible action borders map to the existing Vendeloo tokens.
- Image quality and asset fidelity: A dedicated 1135 × 1386 product asset was generated for the exact hero slot. It preserves the black over-ear headphones, orange plinth, commercial lighting, and negative-space composition without placeholder art.
- Copy and content: The product promise is now “Comprar en vivo es así de fácil.” The mechanism is expressed as `SUBELOO`/offers while the category is consistently “ventas en vivo.” The CTA hierarchy matches the selected direction.

## Focused region comparison

No separate crop was required: at the normalized 375 × 812 comparison size, the headline, live-price module, step labels, button labels, and guest link are all legible in the combined evidence.

## Interaction verification

- `Crear cuenta gratis` opens the account form.
- `Atrás` returns to the entry hero.
- `Ver cómo funciona` navigates to `/onboarding`.
- The onboarding opens with “Ventas en vivo. Precios de verdad.”
- A fresh login render produced no console errors. Firebase emitted one non-blocking IndexedDB deprecation warning.

## Comparison history

### Iteration 1

- P2: `Explorar sin cuenta` fell below the initial 375 × 812 content viewport.
- Fix: compressed the medium-height layout by reducing the hero height, step icon size, CTA spacing, and button height while preserving touch targets.
- Post-fix evidence: `/Users/adammanir/Documents/VENDELOO/docs/design-qa/ventas-en-vivo-login.png` shows the guest action inside the initial viewport.

## Remaining polish

- P3: The reference uses dotted connectors between the three steps; the implementation omits them to keep the labels cleaner at narrow widths.
- P3: The generated headphones are slightly more dominant than in the reference, intentionally increasing product impact without obscuring the live-price module.

final result: passed
