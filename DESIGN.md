# Design

Direction v4 (2026-08-24). Reference-led: crisp near-white product UI with hard hairline grids, a geometric grotesk, black controls, and one saturated colour. Earlier directions (Cloudflare chrome, dense tables, soft pastel cards) are retired.

## The rule that holds the whole thing together

**Red is the only saturated colour in the product, and it means "needs your attention".** High severity, a blocked document, an unverified quote. Everything else — including the four departments — separates by weight on a neutral ink ramp. If a second hue ever shows up in a chart, it is a bug.

## Surfaces

| Token | Value | Use |
|---|---|---|
| `--color-page` | oklch(0.975 0.002 270) | app background |
| `--color-surface` | oklch(1 0 0) | grid cells, sidebar, panels |
| `--color-quiet` | oklch(0.968 0.003 270) | inset blocks, tags, hover |
| `--color-line` | oklch(0.922 0.004 270) | the grid hairlines |
| `--color-line-2` | oklch(0.865 0.006 270) | control borders |

No card shadows. Structure comes from 1px lines: `.grid-shell` (rounded 18px, border-top/left) wrapping `.cell` children (border-right/bottom, 28px padding).

## Colour

- Ink ramp: `0.17` primary, `0.53` secondary, `0.68` tertiary (chroma ≤ 0.012, hue 270).
- Departments as four steps of ink: legal `0.24`, financial `0.44`, hr `0.62`, ip `0.78`. Tags stay neutral; only the leading dot carries the step.
- Severity: high = red `oklch(0.55 0.205 27)`, medium = ink `0.40`, low = ink `0.72`.
- Accent `oklch(0.52 0.215 265)` is chrome only — links, focus rings, the selected row. Never a data colour.
- Primary buttons are ink, not accent.

## Typography

**Satoshi** (Fontshare, 400/500/700/900) for everything, **JetBrains Mono** for citations, filenames and timestamps. Loaded via `<link>` in `index.html` — Vite strips remote `@import` rules from the built CSS, which silently kills the font.

Headings `-0.03em` tracking, body `-0.011em`, labels 11px uppercase `0.08em`. Big numerals at weight 900. `tabular-nums` globally.

## Layout

- Sidebar 268px: bordered nav rows carrying live counts and a chevron, then a department list that filters the register (`?domain=`), then the reviewer card.
- Content: 12-column grid of cells. Overview order — exposure / departments / evidence, data room, connected risk (full width), top findings + activity, briefing (full width).
- Finding detail is a sticky bordered panel next to the list, deep-linked with `?f=id`.

## The five data components

1. **Exposure arc** — half circle, 18px stroke, split by severity share; count and status inside.
2. **Department donut** — 15px stroke, ink-ramp segments, total in the middle.
3. **Evidence bars** — one segment per finding; ink when the quote was found verbatim in the source, red when it was not.
4. **Data room** — a bordered tile per document; the Model Armor block is the only red tile.
5. **Constellation** — shared entity in the centre (red when the cluster carries a high finding), member findings ringed around it, hairline spokes.

## Motion

`cubic-bezier(0.16, 1, 0.3, 1)`. Cells rise 8px on load, panel slides 14px, controls 200ms colour transitions and a 0.985 press scale. All off under `prefers-reduced-motion`.

## Bans

A second saturated hue anywhere in data, soft shadows as structure, serif display type, metric-card rows, side-stripe borders, gradient text, emoji, charts that show no real data.
