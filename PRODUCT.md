# Product

## Register

product

## Users

Maya Chen, an acquisition entrepreneur ("searcher") running a one-person deal team through a four-week due-diligence window on Kestrel Robotics. She opens DealGuard several times a day between calls with outside counsel, usually on a laptop in the evening, to answer one question fast: what changed, and what needs my decision. Secondary viewers: the hackathon jury watching a four-minute demo, who must read the screen at video resolution without a narrator explaining the layout.

## Product Purpose

DealGuard is the risk register a solo acquirer doesn't otherwise have. Five governed agents read every document that lands in the data room, and the dashboard is where a human sees the findings, the evidence behind each one (verbatim citations), the cross-domain links the agents drew, and the audit trail of what was seen and blocked. Success on any screen: the highest-severity open item is the first thing read, every finding can be traced to its source in one click, and the human-only actions (resolve, draft into the Schedule of Exceptions) are unmistakable and irreversible-looking.

## Brand Personality

Precise, unhurried, evidentiary. Three words: counsel-grade, quiet, dense. The interface should feel like a well-kept deal file, not a SaaS marketing dashboard: information first, decoration nowhere. Confidence comes from tabular rigor and citations, never from big numbers or bright colors.

## Anti-references

- The "hero-metric" SaaS dashboard: rows of identical white cards with a big number, a small label and an icon.
- Cloudflare/GCP-console chrome: graphite sidebar against a white content area with an orange accent (the original spec direction, retired 2026-08-24).
- Generic AI-tool look: pure white and pure black, untinted grays, Inter everywhere at one size, gradient accents, emoji, illustrations.
- Anything that reads as "startup analytics": sparklines for their own sake, donut charts, green-up/red-down arrows.

## Design Principles

- Evidence before verdict: a finding is never shown without its citation and verification state nearby.
- Severity is the sort key and the loudest visual signal; everything else stays quiet.
- Density over whitespace: a deal file has many lines; the screen should hold them, table-first.
- Human actions look like signatures: resolve and draft are deliberate, confirmed, attributed.
- Familiar affordances only (Linear, Stripe, Notion vocabulary); the tool disappears into the review.

## Accessibility & Inclusion

Looks first per the owner's call. Baseline kept anyway: keyboard focus visible, contrast readable on a laptop in the evening, severity never encoded by color alone (always paired with a word), `prefers-reduced-motion` respected.
