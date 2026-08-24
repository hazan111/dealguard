# Design

Direction v3 (2026-08-24), from reference boards the owner selected: soft tinted ground, floating rounded cards, an icon rail, and **charts carrying the page**. v1 (Cloudflare chrome) and v2 (dense hairline tables) are retired. Every chart here is drawn from real deal data; nothing decorative.

## Ground and surfaces

Warm oat paper, never white-on-white. Cards float on it with a soft double shadow, radius 24px.

| Token | Value | Use |
|---|---|---|
| `--color-ground` | oklch(0.962 0.012 85) | page |
| `--color-card` | oklch(0.995 0.003 85) | floating cards, rail |
| `--color-sunk` | oklch(0.975 0.008 85) | inset blocks, tiles, soft buttons |
| `--color-hair` | oklch(0.92 0.010 85) | dividers, chart tracks |
| `--shadow-card` | 0 1px 2px / 0 14px 34px -18px, warm-tinted | every card |

## Color

Restrained chrome, full palette inside data.

- Ink: `oklch(0.26 0.018 275)` / secondary `0.50` / tertiary `0.66` — all tinted toward the accent hue.
- Accent (rail active, primary buttons, links): deep indigo `oklch(0.38 0.095 275)`, soft `oklch(0.93 0.030 275)`.
- Severity: high `oklch(0.57 0.17 25)`, medium `oklch(0.73 0.14 70)`, low `oklch(0.66 0.03 85)`.
- Departments (donut, constellation, chips): legal indigo 275, financial gold 75, hr moss 155, ip plum 340.
- Verified/resolved: moss `oklch(0.58 0.12 155)`.

## Typography

- Display: **Fraunces** (variable, opsz 96, SOFT 30) — page titles, hero numerals, entity names. Italic at opsz 14 for **document quotes and seller questions**: evidence reads as quoted material, which is the product's whole point.
- UI: **Outfit** 300–600 — labels, body, data. `tabular-nums` globally.
- Labels: 10.5px, uppercase, 0.12em tracking. Body 13–14px. Page titles 34–38px.

## Layout

- Floating icon rail, 78px, radius 28px, sticky full height. Icon + 9.5px label, active state = accent-soft rounded square.
- 12-column bento at 20px gutters: exposure / donut / evidence across the top, data room full width, then connected risk + top findings, then briefing + activity.
- Detail view is a sticky drawer card beside the list (deep-linked `?f=id`), never a modal.

## The five data components

1. **Exposure arc** — half circle, 30px stroke, round caps, split by severity share; count and status word inside, legend below.
2. **Department donut** — 22px stroke, gapped rounded segments, total in the middle.
3. **Evidence bars** — one segment per finding per department, colored when the quote was found verbatim in the source, amber when it was not.
4. **Data room** — a tile per document: routed department, finding count, ingest time; a Model Armor block is the only red tile.
5. **Constellation** — the shared entity at the center, member findings orbiting in department colors, hairline curves between. This is the cross-domain story the product exists to tell.

## Motion

Cards rise 10px with a 40ms stagger on load (520ms, ease-out-quart), drawer slides 18px. Hover/active transitions 160–200ms. Everything off under `prefers-reduced-motion`.

## Bans

Dark sidebar, orange accent, hairline data tables, metric-card rows, side-stripe borders, gradient text, emoji, illustrations, charts that show no real data.
