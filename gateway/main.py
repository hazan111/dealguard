"""DealGuard Gateway — custom Agent Gateway SUBSTITUTE (Cloud Run / local).

The platform's native Agent Gateway is Private Preview and inaccessible on this
project (disclosed in README §3). This service performs the same conceptual
job: screen incoming content with Model Armor, classify the document, route it
to the Orchestrator agent over A2A, and log every routing decision.

Poisoned-document behavior implemented: the ENTIRE document is blocked and
flagged for manual human review (the simpler fallback SCENARIO.md allows;
stated plainly in the submission).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dealguard_shared.config import load_dotenv

load_dotenv()

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from dealguard_shared import firestore_client as store
from dealguard_shared.config import config
from dealguard_shared.schemas import Classification

import model_armor_client

app = FastAPI(title="DealGuard Gateway (Agent Gateway substitute)")

ORCHESTRATOR_A2A_URL = os.environ.get("ORCHESTRATOR_A2A_URL", "http://127.0.0.1:8100")
# Shared-secret auth between drive-watcher and gateway. Fail closed: if the
# token is not configured, ingestion is refused rather than left open.
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")


def require_service_token(x_dealguard_token: str | None) -> None:
    if not SERVICE_TOKEN:
        raise HTTPException(503, "SERVICE_TOKEN not configured — ingestion disabled")
    if x_dealguard_token != SERVICE_TOKEN:
        raise HTTPException(403, "bad service token")


class IngestRequest(BaseModel):
    document_id: str
    name: str
    drive_url: str = ""
    text: str


def _classify(name: str, text: str) -> Classification:
    from google import genai
    client = genai.Client(vertexai=True, project=config.project, location=config.gemini_location)
    resp = client.models.generate_content(
        model=config.gemini_model,
        contents=(
            "Classify this M&A due-diligence document into exactly one category: "
            "legal (contracts, litigation, corporate records), financial (financial "
            "statements, debt, revenue), hr (compensation, employment, benefits), "
            "ip (patents, trademarks, licenses), or unclassified.\n\n"
            f"FILENAME: {name}\n\nFIRST 4000 CHARS:\n{text[:4000]}"
        ),
        config={"response_mime_type": "application/json", "response_schema": Classification},
    )
    return Classification.model_validate_json(resp.text)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/ingest")
def ingest(req: IngestRequest, x_dealguard_token: str | None = Header(default=None)):
    require_service_token(x_dealguard_token)
    text_hash = store.content_hash(req.text)
    if store.document_already_processed(req.document_id, text_hash):
        return {"status": "duplicate", "document_id": req.document_id}

    # 1. Model Armor screens BEFORE any agent reasoning touches the content.
    verdict = model_armor_client.screen_text(req.text)
    if verdict.blocked:
        store.create_document_record(
            doc_id=req.document_id, name=req.name, drive_url=req.drive_url,
            category="unclassified", model_armor_verdict="blocked",
            armor_detail=", ".join(verdict.matched_filters),
            routed_to_agent="none", text_hash=text_hash)
        store.append_timeline_event(
            event_type="model_armor_block",
            description=(f"Model Armor BLOCKED document '{req.name}' before agent reasoning "
                         f"(matched filters: {', '.join(verdict.matched_filters)}). "
                         "Document flagged for manual human review."),
            related_document_id=req.document_id)
        store.add_dead_letter(document_id=req.document_id, document_name=req.name,
                              reason="model_armor_block",
                              detail=json.dumps(verdict.raw)[:1500])
        return {"status": "blocked", "document_id": req.document_id,
                "matched_filters": verdict.matched_filters}

    # 2. Lightweight classification, then forward to the Orchestrator over A2A.
    classification = _classify(req.name, req.text)
    payload = {
        "document_id": req.document_id,
        "name": req.name,
        "drive_url": req.drive_url,
        "category": classification.category,
        "text": req.text,
        "model_armor_verdict": "clean",
    }
    from dealguard_shared.a2a_client import a2a_send
    reply = a2a_send(ORCHESTRATOR_A2A_URL, json.dumps(payload),
                     timeout_s=float(os.environ.get("ORCHESTRATOR_TIMEOUT_S", "300")),
                     idempotency_key=f"gw-{req.document_id}-{text_hash[:8]}",
                     retries=1)
    try:
        result = json.loads(reply)
    except json.JSONDecodeError:
        result = {"status": "error", "raw_reply": reply[:500]}
    result.setdefault("category", classification.category)
    return result
