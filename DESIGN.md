# Design

Direction (2026-08-24): Linear/Stripe-grade product UI. Single light surface with a slightly warmer, paper-toned sidebar panel. One ink accent, full semantic palette for severity and status. Table-first density. This supersedes the earlier Cloudflare-inspired direction in `docs/DESIGN_SYSTEM.md`.

## Color

Scene: evening, laptop, quiet office, a person reading a deal file. Light theme; no dark toggle.

All values OKLCH; neutrals tinted toward the paper hue (h 75, chroma 0.006) so nothing is a raw gray.

| Token | Value | Use |
|---|---|---|
| `--bg` | oklch(0.985 0.004 75) | page ground |
| `--panel` | oklch(0.965 0.006 75) | sidebar, table header, side panel |
| `--raised` | oklch(0.995 0.002 75) | rows on hover, inputs |
| `--line` | oklch(0.90 0.008 75) | hairlines |
| `--line-strong` | oklch(0.82 0.01 75) | table header rule, focus ring base |
| `--ink` | oklch(0.22 0.012 265) | primary text |
| `--ink-2` | oklch(0.48 0.016 265) | secondary text, labels |
| `--ink-3` | oklch(0.64 0.014 265) | tertiary, placeholders |
| `--accent` | oklch(0.40 0.09 265) | primary buttons, links, selection, active nav |
| `--accent-soft` | oklch(0.94 0.02 265) | selected row, active nav ground |
| `--sev-high` | oklch(0.55 0.19 27) | severity high |
| `--sev-high-soft` | oklch(0.95 0.03 27) | high pill ground |
| `--sev-med` | oklch(0.62 0.15 65) | severity medium |
| `--sev-med-soft` | oklch(0.96 0.035 80) | medium pill ground |
| `--sev-low` | oklch(0.60 0.02 265) | severity low |
| `--ok` | oklch(0.58 0.14 150) | resolved, verified |
| `--ok-soft` | oklch(0.95 0.03 150) | resolved pill ground |
| `--warn` | oklch(0.66 0.14 75) | needs review |

Strategy: Restrained for chrome (accent under 10% of the surface), Full palette only inside data (severity, status, verification).

## Typography

- UI family: Instrument Sans (Google Fonts), fallback system-ui. Weights 400 / 500 / 600.
- Data family: JetBrains Mono, fallback ui-monospace. Used for finding ids, citations, timestamps, counts in tables. `font-variant-numeric: tabular-nums` everywhere digits align.
- Scale (rem, ratio 1.2): 11 label · 12 meta · 13 table · 14 body · 16 section · 20 page title. Page titles 600, section headers 500 uppercase 11px with 0.08em tracking, body 400.
- Line length for prose (briefing script, summaries): 70ch max.

## Spacing and layout

- 4px base. Row height 36px in tables, 32px controls, 20px pills.
- Sidebar 220px, panel-toned, 1px line on the right. Content max 1240px, 32px gutters.
- Detail view is a right side panel (440px) that pushes content, not a modal overlay.
- No cards for metrics. Summary is an inline stat strip separated by hairlines.

## Components

- Button: 32px, radius 6px. Primary = accent ground, white text. Secondary = raised ground, 1px line. Danger (resolve) = ok-green ground after an inline confirm step. Focus: 2px accent ring offset 2px.
- Pill: 20px, radius 999, 11px 500, tinted ground + colored text; severity pills carry a 6px dot plus the word.
- Table: header 11px uppercase on panel ground, rows 36px, hairline between rows, hover raised ground, selected accent-soft. Severity column first, tabular.
- Side panel: panel ground, 24px padding, sections separated by 11px labels, citation set in mono inside a raised block.
- Nav item: 32px, radius 6px, active = accent-soft ground + accent text + 500 weight.

## Motion

150 to 200ms, ease-out-quart, only on hover/focus/panel open. Panel slides 12px + fades. Respect `prefers-reduced-motion`.

## Bans (on top of impeccable's)

Orange accent, dark sidebar, metric cards, emoji, illustrations, gradient text, side-stripe borders.
