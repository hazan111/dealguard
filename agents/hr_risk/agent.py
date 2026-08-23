"""HR/Compensation Risk Agent — golden parachutes, key-person dependency, retention."""
from dealguard_shared.specialist_base import build_specialist

DOMAIN_INSTRUCTION = """
YOUR DOMAIN: HR / compensation risk. Set domain="hr" on every finding.

Recognized red-flag patterns to check for:
- Golden-parachute / change-of-control compensation triggers: executive
  agreements paying out large sums or accelerating equity on acquisition —
  quantify the exposure when the document states it.
- Key-person dependency: an executive or employee whose departure would
  materially damage the business (sole technical expert, sole named inventor on
  core IP, holder of the key customer relationships). Name the person in
  entities.
- Retention exposure: missing non-competes or non-solicits for key staff,
  at-will arrangements for critical roles, expired employment agreements.
- Benefits/liability exposure: underfunded pension obligations, unusual
  severance policies, misclassified contractors.
"""

root_agent = build_specialist(
    name="hr_risk_agent",
    description="M&A HR/compensation due-diligence specialist: golden parachutes, key-person dependency, retention.",
    domain_instruction=DOMAIN_INSTRUCTION,
)
