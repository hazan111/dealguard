"""Deterministic document-processing pipeline run by the Orchestrator agent.

Implements the failure-tolerance contract of ARCHITECTURE §2a:
- bounded timeout + single retry on every specialist A2A call
- schema validation with one retry (validation error fed back to the agent)
- citation verification before any finding is accepted as confirmed
- dead-letter queue after two failures on the same document
- idempotent finding ids (retried calls cannot create duplicates)
- conflicting findings flagged for a human, never silently resolved
"""
import hashlib
import json
import os
from typing import Literal, Optional

from pydantic import BaseModel, ValidationError

from dealguard_shared import firestore_client as store
from dealguard_shared.citation import citation_verified
from dealguard_shared.config import config
from dealguard_shared.schemas import SpecialistReport

from dealguard_shared.a2a_client import A2AError, a2a_send

SPECIALIST_URLS = {
    "legal": os.environ.get("LEGAL_AGENT_A2A_URL", "http://127.0.0.1:8101"),
    "financial": os.environ.get("FINANCIAL_AGENT_A2A_URL", "http://127.0.0.1:8102"),
    "hr": os.environ.get("HR_AGENT_A2A_URL", "http://127.0.0.1:8103"),
    "ip": os.environ.get("IP_AGENT_A2A_URL", "http://127.0.0.1:8104"),
}

SPECIALIST_TIMEOUT_S = float(os.environ.get("SPECIALIST_TIMEOUT_S", "120"))


class CrossRefDecision(BaseModel):
    existing_finding_id: str
    relation: Literal["updates", "conflicts", "related", "unrelated"]
    new_severity: Optional[Literal["low", "medium", "high"]] = None
    reason: str


class CrossRefResult(BaseModel):
    decisions: list[CrossRefDecision]


def _genai_client():
    from google import genai
    return genai.Client(vertexai=True, project=config.project, location=config.gemini_location)


def _finding_id(document_id: str, pattern: str) -> str:
    return hashlib.sha256(f"{document_id}|{pattern}".encode()).hexdigest()[:12]


def _specialist_prompt(name: str, text: str) -> str:
    return (
        "Analyze the following due-diligence document and return your findings "
        "as JSON matching your output schema.\n\n"
        f"DOCUMENT NAME: {name}\n\nDOCUMENT TEXT:\n{text}"
    )


def _parse_report(raw: str) -> SpecialistReport:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        cleaned = cleaned[4:] if cleaned.startswith("json") else cleaned
    return SpecialistReport.model_validate_json(cleaned.strip())


def _call_specialist(category: str, doc_name: str, text: str, idem_key: str) -> SpecialistReport:
    """A2A call + schema validation, each with one bounded retry."""
    url = SPECIALIST_URLS[category]
    raw = a2a_send(url, _specialist_prompt(doc_name, text),
                   timeout_s=SPECIALIST_TIMEOUT_S, idempotency_key=idem_key, retries=1)
    try:
        return _parse_report(raw)
    except (ValidationError, json.JSONDecodeError, ValueError) as exc:
        retry_prompt = (
            f"{_specialist_prompt(doc_name, text)}\n\n"
            f"Your previous reply failed schema validation with this error, fix it and "
            f"return ONLY valid JSON:\n{exc}"
        )
        raw = a2a_send(url, retry_prompt, timeout_s=SPECIALIST_TIMEOUT_S,
                       idempotency_key=idem_key + "-fix", retries=0)
        return _parse_report(raw)


def _cross_reference(new_finding: dict, candidates: list[dict]) -> list[CrossRefDecision]:
    """One structured Gemini call deciding how the new finding relates to
    existing findings that share an entity with it."""
    if not candidates:
        return []
    client = _genai_client()
    prompt = {
        "task": (
            "You are the orchestrator of an M&A due-diligence team. A new finding was "
            "just produced. For EACH existing finding below, decide the relation: "
            "'updates' (the new information changes the risk level or substance of the "
            "existing finding — set new_severity if it should change), 'conflicts' (the two "
            "findings contradict each other about the same fact), 'related' (same underlying "
            "risk cluster, worth linking, no severity change), or 'unrelated'."
        ),
        "new_finding": {k: new_finding.get(k) for k in
                        ("summary", "domain", "severity", "entities", "red_flag_pattern")},
        "existing_findings": [
            {"existing_finding_id": c["id"],
             **{k: c.get(k) for k in ("summary", "domain", "severity", "entities", "red_flag_pattern", "status")}}
            for c in candidates
        ],
    }
    resp = client.models.generate_content(
        model=config.gemini_model,
        contents=json.dumps(prompt),
        config={"response_mime_type": "application/json", "response_schema": CrossRefResult},
    )
    return CrossRefResult.model_validate_json(resp.text).decisions


def _rewrite_deal_memory() -> None:
    """Memory Bank fallback (ARCHITECTURE §6): deterministic running summary —
    the deal's context is structured, no LLM call needed (keeps cost at zero)."""
    lines = []
    for f in store.list_findings():
        if f.get("status") == "resolved":
            continue
        lines.append(f"[{f.get('domain')}/{f.get('severity')}/{f.get('status')}] "
                     f"{f.get('summary')} (entities: {', '.join(f.get('entities', []))})")
    store.write_deal_memory("\n".join(lines) or "No open findings yet.")


def process_document(payload: dict) -> dict:
    """Entry point. payload: {document_id, name, drive_url, category, text,
    model_armor_verdict, model_armor_detail}"""
    doc_id = payload["document_id"]
    name = payload.get("name", doc_id)
    category = payload.get("category", "unclassified")
    text = payload.get("text", "")
    text_hash = store.content_hash(text)

    # De-dup by document ID + content hash (duplicate Drive notifications).
    if store.document_already_processed(doc_id, text_hash):
        return {"status": "duplicate", "document_id": doc_id}

    store.create_document_record(
        doc_id=doc_id, name=name, drive_url=payload.get("drive_url", ""),
        category=category,
        model_armor_verdict=payload.get("model_armor_verdict", "clean"),
        armor_detail=payload.get("model_armor_detail", ""),
        routed_to_agent=f"{category}_risk_agent" if category in SPECIALIST_URLS else "none",
        text_hash=text_hash,
    )
    store.append_timeline_event(
        event_type="document_ingested",
        description=f"Document '{name}' ingested and routed to {category} specialist"
        if category in SPECIALIST_URLS else f"Document '{name}' ingested (category: {category})",
        related_document_id=doc_id,
    )

    if category not in SPECIALIST_URLS:
        return {"status": "unclassified", "document_id": doc_id, "findings": []}

    idem_key = f"{doc_id}-{text_hash[:8]}"
    try:
        report = _call_specialist(category, name, text, idem_key)
    except (A2AError, ValidationError, ValueError, json.JSONDecodeError) as exc:
        # Two strikes → dead-letter queue, never silently dropped.
        store.add_dead_letter(document_id=doc_id, document_name=name,
                             reason="specialist_failed", detail=str(exc)[:1500])
        store.append_timeline_event(
            event_type="finding_created",
            description=f"Specialist failed twice on '{name}' — routed to human-review dead-letter queue",
            related_document_id=doc_id)
        return {"status": "dead_letter", "document_id": doc_id, "error": str(exc)[:500]}

    results = []
    for finding in report.findings:
        # App-layer zero-trust guard: a specialist can only produce findings in
        # the domain the document was routed for.
        if finding.domain != category:
            continue

        verified = citation_verified(finding.citation_quote, text)
        fid = _finding_id(doc_id, finding.red_flag_pattern)
        row = {
            "id": fid,
            "document_id": doc_id,
            "domain": finding.domain,
            "summary": finding.summary,
            "red_flag_pattern": finding.red_flag_pattern,
            "citation": f"{finding.citation_ref} — \"{finding.citation_quote}\"",
            "citation_verified": verified,
            "severity": finding.severity,
            "recommended_action": finding.recommended_action,
            "suggested_followup_question": finding.suggested_followup_question,
            "entities": finding.entities,
            # Unverifiable citation → needs_review, never a confirmed finding.
            "status": "open" if verified else "needs_review",
        }

        candidates = store.find_cross_reference_candidates(finding.entities, doc_id)
        linked_ids, conflict_ids = [], []
        for decision in _cross_reference(row, candidates):
            existing = store.get_finding(decision.existing_finding_id)
            if not existing or decision.relation == "unrelated":
                continue
            linked_ids.append(decision.existing_finding_id)
            if decision.relation == "updates" and decision.new_severity and \
                    decision.new_severity != existing.get("severity"):
                store.update_finding(decision.existing_finding_id, {
                    "severity": decision.new_severity,
                    "cross_referenced_finding_ids":
                        sorted(set(existing.get("cross_referenced_finding_ids", []) + [fid])),
                })
                store.append_timeline_event(
                    event_type="finding_updated",
                    description=f"Severity of existing finding raised to {decision.new_severity}: {decision.reason}",
                    related_document_id=doc_id, related_finding_id=decision.existing_finding_id)
            elif decision.relation == "conflicts":
                conflict_ids.append(decision.existing_finding_id)
                store.append_timeline_event(
                    event_type="finding_updated",
                    description=f"CONFLICTING FINDINGS flagged for human review: {decision.reason}",
                    related_document_id=doc_id, related_finding_id=decision.existing_finding_id)
            else:
                store.update_finding(decision.existing_finding_id, {
                    "cross_referenced_finding_ids":
                        sorted(set(existing.get("cross_referenced_finding_ids", []) + [fid])),
                })

        row["cross_referenced_finding_ids"] = sorted(set(linked_ids))
        if conflict_ids:
            # The orchestrator never resolves a conflict itself — humans do.
            row["conflict_with"] = conflict_ids
            row["status"] = "needs_review"
        store.create_finding(row)
        store.append_timeline_event(
            event_type="finding_created",
            description=f"[{finding.severity.upper()}] {finding.summary[:160]}"
            + ("" if verified else " (citation unverified — needs review)"),
            related_document_id=doc_id, related_finding_id=fid)
        results.append({"id": fid, "summary": finding.summary,
                        "severity": finding.severity, "status": row["status"],
                        "cross_referenced": linked_ids})

    _rewrite_deal_memory()
    return {"status": "processed", "document_id": doc_id,
            "relevant": report.document_relevant, "findings": results}
