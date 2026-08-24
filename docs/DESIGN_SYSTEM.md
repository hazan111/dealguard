# DealGuard — Design System

> **Superseded 2026-08-24.** The Cloudflare-inspired direction below (dark sidebar, orange accent, metric tiles) was retired after review; the shipped dashboard follows the Linear/Stripe-grade product direction documented in the repo-root `DESIGN.md` (single light surface, paper-toned OKLCH neutrals, ink-blue accent, Instrument Sans + JetBrains Mono, table-first density, side panel instead of modal). Kept for history.

Cloudflare-dashboard-inspired. Applies to the web dashboard only.

## Layout

- Dark/graphite left sidebar for navigation (Dashboard, Risk Register, Audit Trail, Settings).
- Light main content area — do not make the whole app dark-mode; the sidebar/content contrast is the point, not a fully dark UI.
- Top of the main content area: a row of summary metric tiles (total findings, open risks, documents processed, blocked injection attempts) before any table or detail view.

## Color Tokens

```css
--color-sidebar-bg: #14171a;      /* graphite/near-black */
--color-sidebar-text: #b4b9bf;
--color-sidebar-text-active: #ffffff;

--color-background: #ffffff;
--color-surface: #f7f8f9;         /* card/table backgrounds */
--color-border: #e4e7eb;
--color-text-primary: #14171a;
--color-text-secondary: #6b7280;

--color-accent: #f6821f;          /* Cloudflare-style orange */
--color-accent-hover: #d96f13;

--color-status-open: #dc2626;       /* red — open risk, always visually dominant */
--color-status-review: #94a3b8;     /* gray — under review */
--color-status-resolved: #16a34a;   /* green — resolved */
```

Do not introduce additional accent colors — orange is the single brand accent, consistent with the Cloudflare-style reference.

## Typography

- Font: Inter (consistent with FieldOps — no reason to introduce a second font across the portfolio).
- Headings: 600 weight. Body: 400. Table headers/labels: 500, uppercase, letter-spacing slightly increased (a Cloudflare-dashboard characteristic) — small caps-style table headers, not large decorative headings.

## Components

- Tailwind + shadcn/ui, same as FieldOps.
- Summary metrics: `SummaryTile.tsx` — a card with a large number, a small label, and a subtle icon (lucide-react), not a chart — charts are reserved for a future analytics view, not needed for the hackathon scope.
- Risk register table: sortable/filterable by domain (legal/financial/hr/ip), severity, and status. Status shown as a colored badge using the tokens above.
- Risk detail (click a row): shows the citation back to the source document, the cross-referenced findings (if any), and the resolve action (human-only — this button should be visually distinct, e.g. requires a confirmation step, since it's an irreversible audit action).
- Audit trail screen: a simple reverse-chronological timeline list (`deal_timeline`), each entry showing an icon by event type (document ingested, finding created, Model Armor block, briefing generated).
- Voice briefing player: a minimal audio player component (`VoiceBriefingPlayer.tsx`) with a single play/pause control and the briefing date — no need for a full media-player UI.

## Icons

`lucide-react`, consistent with FieldOps.

## What NOT to do

- No dark-mode toggle for the main content area — the sidebar is the only dark surface.
- No additional accent colors beyond the single orange.
- No decorative illustration — this is a compliance-adjacent enterprise tool; keep it restrained, data-forward.
