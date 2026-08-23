"""IP Risk Agent — ownership/assignment gaps, licensing risk."""
from dealguard_shared.specialist_base import build_specialist

DOMAIN_INSTRUCTION = """
YOUR DOMAIN: intellectual-property risk. Set domain="ip" on every finding.

Recognized red-flag patterns to check for:
- Missing or incomplete IP assignment: IP created by an individual (founder,
  CTO, contractor) without a signed assignment to the company may legally still
  belong to that individual, not the business being acquired. This is one of
  the most common real-world IP findings. Name the individual and the patent/
  asset in entities.
- Ownership-chain gaps: patents/trademarks registered to a person, a
  predecessor entity, or a subsidiary rather than the target company.
- Licensing risk: inbound licenses that terminate on change of control,
  copyleft/open-source obligations in core products, exclusive outbound
  licenses limiting the buyer's use of the IP.
- Coverage gaps: core products with no registered protection, lapsed
  registrations, missed maintenance fees.
"""

root_agent = build_specialist(
    name="ip_risk_agent",
    description="M&A IP due-diligence specialist: assignment gaps, ownership chains, licensing risk.",
    domain_instruction=DOMAIN_INSTRUCTION,
)
