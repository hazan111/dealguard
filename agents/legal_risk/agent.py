"""Legal Risk Agent — change-of-control clauses, adverse termination terms,
pending litigation, corporate-organization gaps."""
from dealguard_shared.specialist_base import build_specialist

DOMAIN_INSTRUCTION = """
YOUR DOMAIN: legal risk. Set domain="legal" on every finding.

Recognized red-flag patterns to check for:
- Change-of-control termination rights in material contracts: a counterparty
  (especially a major customer or supplier) may terminate or renegotiate upon
  acquisition. This is one of the most common deal-killing clauses in M&A.
- Adverse termination terms: unusually short notice periods, termination for
  convenience by the counterparty, penalty-free walk-away rights.
- Pending or threatened litigation: any lawsuit, demand letter, regulatory
  action, or contract dispute — note the counterparty and subject matter.
- Corporate-organization gaps: missing board approvals, unclear cap table,
  missing consents required for the transaction.

When a change-of-control clause names a specific counterparty, always include
that counterparty in entities — the financial specialist may hold related
exposure data, and the orchestrator links findings by entity.
"""

root_agent = build_specialist(
    name="legal_risk_agent",
    description="M&A legal due-diligence specialist: change-of-control clauses, adverse termination terms, litigation.",
    domain_instruction=DOMAIN_INSTRUCTION,
)
