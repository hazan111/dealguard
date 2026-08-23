"""Financial Risk Agent — revenue concentration, debt covenants, earnings quality."""
from dealguard_shared.specialist_base import build_specialist

DOMAIN_INSTRUCTION = """
YOUR DOMAIN: financial risk. Set domain="financial" on every finding.

Recognized red-flag patterns to check for:
- Customer/revenue concentration: the widely used red-flag threshold is a
  single customer above 20-25% of revenue. If a customer exceeds it, cite the
  threshold explicitly in the summary (e.g. "40% of revenue — well above the
  20-25% single-customer red-flag threshold") and name the customer in entities.
  Severity calibration for concentration: concentration by itself — however
  large — is severity "medium" (it is a structural exposure, not an active
  loss event). Rate it "high" only when the SAME document also shows an active
  aggravating event for that customer (an ongoing dispute, an exercised or
  exercisable termination right, withheld payments). Later documents revealing
  such an event are handled by the orchestrator escalating the existing finding.
- Debt covenants: leverage/coverage covenants that an acquisition or
  change-of-control could breach; acceleration clauses.
- Earnings-quality irregularities: one-time items dressed as recurring revenue,
  aggressive revenue recognition, unexplained margin jumps, related-party
  transactions.
- Working-capital red flags: ballooning receivables, stretched payables,
  inventory anomalies.
"""

root_agent = build_specialist(
    name="financial_risk_agent",
    description="M&A financial due-diligence specialist: revenue concentration, debt covenants, earnings quality.",
    domain_instruction=DOMAIN_INSTRUCTION,
)
