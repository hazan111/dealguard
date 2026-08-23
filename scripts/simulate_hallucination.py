"""Reproducible demo of the hallucination-recovery gate (ARCHITECTURE §2a).

Runs the REAL orchestrator pipeline against the REAL Firestore, but replaces
the specialist call with a simulated hallucinating reply whose citation_quote
does not exist in the source document. The pipeline must write the finding as
`needs_review` (never `open`), which the dashboard renders with a red
"Quote NOT verified" marker.

Usage: .venv/bin/python scripts/simulate_hallucination.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "agents", "orchestrator"))

from dealguard_shared.config import load_dotenv

load_dotenv()

import pipeline
from dealguard_shared import firestore_client as store
from dealguard_shared.schemas import SpecialistReport

FAKE = SpecialistReport.model_validate({
    "document_relevant": True,
    "findings": [{
        "domain": "legal",
        "summary": "The agreement contains an uncapped pre-closing tax indemnity.",
        "red_flag_pattern": "Uncapped indemnification obligation",
        "citation_ref": "Section 11.2",
        "citation_quote": "Seller shall indemnify Buyer for all pre-closing tax liabilities without cap or basket",
        "severity": "high",
        "recommended_action": "indemnity",
        "suggested_followup_question": None,
        "entities": ["Kestrel Robotics, Inc."],
    }],
})
pipeline._call_specialist = lambda *a, **k: FAKE

result = pipeline.process_document({
    "document_id": "hallucination-demo-1",
    "name": "hallucination_demo.pdf",
    "category": "legal",
    "text": ("DRAFT AGREEMENT. Section 11.2 remains subject to further "
             "negotiation. No indemnification terms have been agreed."),
})
finding = store.get_finding(result["findings"][0]["id"])
assert finding["status"] == "needs_review" and not finding["citation_verified"]
print("OK — hallucinated citation routed to needs_review, never confirmed:")
print("   ", finding["citation"])
