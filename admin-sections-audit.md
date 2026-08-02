# Admin sections audit — Personas, Ventas y Ajustes

## Scope

Combined UX and visual audit of the three authenticated admin sections shown on 2026-08-02. The administrator's goal is to scan many records quickly, understand state at a glance and reach high-risk actions without making them visually dominant.

## Evidence

1. Personas — `Screenshot 2026-08-02 at 4.58.02 PM.png`
2. Ventas — `Screenshot 2026-08-02 at 4.58.13 PM.png`
3. Ajustes — `Screenshot 2026-08-02 at 4.58.49 PM.png`

## Findings

### 1. Personas — needs improvement

- The original rows left most of the available width empty while placing identity, role and balance at opposite extremes.
- Large balances dominated the scan even though role, location and activity are usually more useful for administration.
- The redesign introduces a directory header, compact summary counts and stable columns for identity, role, activity and balance.

### 2. Ventas — needs improvement

- Small thumbnails made the product list feel like a log rather than a sales workspace.
- Destructive red buttons repeated on every row and became the strongest visual element on the page.
- The redesign turns active publications into responsive product cards with larger imagery and demotes cancellation to a secondary danger action.

### 3. Ajustes — needs improvement

- Six large inputs arranged in two columns made the payment card unnecessarily tall.
- Generous panel and field spacing pushed related configuration below the fold.
- The redesign uses a three-column payment grid on desktop and tighter, scoped spacing while preserving every field and action.

## Accessibility limits

The supplied screenshots confirm hierarchy, density and visible target sizing only. Keyboard order, focus appearance, screen-reader labels and live Firestore state changes require interactive verification in the authenticated build.
