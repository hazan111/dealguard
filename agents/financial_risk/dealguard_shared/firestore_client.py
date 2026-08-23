"""Thin Firestore wrappers — the single copy both the orchestrator and the
dashboard backend import, per TASKLIST Phase 2."""
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from google.cloud import firestore

from .config import config

_db: Optional[firestore.Client] = None


def db() -> firestore.Client:
    global _db
    if _db is None:
        _db = firestore.Client(project=config.firestore_project, database=config.firestore_database)
    return _db


def _now() -> datetime:
    return datetime.now(timezone.utc)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


# ---------- documents ----------

def document_already_processed(doc_id: str, text_hash: str) -> bool:
    """De-dup: same Drive file + same content hash → already handled."""
    snap = db().collection("documents").document(doc_id).get()
    return snap.exists and snap.get("content_hash") == text_hash


def create_document_record(*, doc_id: str, name: str, drive_url: str, category: str,
                           model_armor_verdict: str, routed_to_agent: str,
                           text_hash: str, armor_detail: str = "") -> None:
    db().collection("documents").document(doc_id).set({
        "id": doc_id,
        "name": name,
        "drive_url": drive_url,
        "category": category,
        "ingested_at": _now(),
        "model_armor_verdict": model_armor_verdict,
        "model_armor_detail": armor_detail,
        "routed_to_agent": routed_to_agent,
        "content_hash": text_hash,
    })


# ---------- risk findings ----------

def create_finding(payload: dict[str, Any]) -> str:
    fid = payload.get("id") or uuid.uuid4().hex[:12]
    payload.update({"id": fid, "created_at": _now(), "resolved_by": None, "resolved_at": None})
    payload.setdefault("status", "open")
    payload.setdefault("cross_referenced_finding_ids", [])
    db().collection("risk_findings").document(fid).set(payload)
    return fid


def update_finding(fid: str, updates: dict[str, Any]) -> None:
    db().collection("risk_findings").document(fid).update(updates)


def get_finding(fid: str) -> Optional[dict[str, Any]]:
    snap = db().collection("risk_findings").document(fid).get()
    return snap.to_dict() if snap.exists else None


def list_findings(status: Optional[str] = None) -> list[dict[str, Any]]:
    q = db().collection("risk_findings")
    if status:
        q = q.where(filter=firestore.FieldFilter("status", "==", status))
    rows = [s.to_dict() for s in q.stream()]
    rows.sort(key=lambda r: r.get("created_at") or _now(), reverse=True)
    return rows


def resolve_finding(fid: str, resolved_by: str) -> bool:
    """Human-only action — the API layer enforces auth; this enforces the audit fields."""
    ref = db().collection("risk_findings").document(fid)
    if not ref.get().exists:
        return False
    ref.update({"status": "resolved", "resolved_by": resolved_by, "resolved_at": _now()})
    return True


def find_cross_reference_candidates(entities: list[str], exclude_document_id: str) -> list[dict[str, Any]]:
    """Lightweight entity-overlap matching (disclosed as such in the submission)."""
    if not entities:
        return []
    wanted = {e.strip().lower() for e in entities if e and len(e.strip()) >= 3}
    out = []
    for row in list_findings():
        if row.get("document_id") == exclude_document_id:
            continue
        theirs = {str(e).strip().lower() for e in row.get("entities", [])}
        if wanted & theirs:
            out.append(row)
    return out


# ---------- timeline ----------

def append_timeline_event(*, event_type: str, description: str,
                          related_document_id: Optional[str] = None,
                          related_finding_id: Optional[str] = None) -> None:
    eid = uuid.uuid4().hex[:12]
    db().collection("deal_timeline").document(eid).set({
        "id": eid,
        "event_type": event_type,
        "description": description,
        "related_document_id": related_document_id,
        "related_finding_id": related_finding_id,
        "occurred_at": _now(),
    })


def list_timeline(limit: int = 200) -> list[dict[str, Any]]:
    q = db().collection("deal_timeline").order_by("occurred_at", direction=firestore.Query.DESCENDING).limit(limit)
    return [s.to_dict() for s in q.stream()]


# ---------- dead letter ----------

def add_dead_letter(*, document_id: str, document_name: str, reason: str, detail: str) -> None:
    eid = uuid.uuid4().hex[:12]
    db().collection("dead_letter").document(eid).set({
        "id": eid, "document_id": document_id, "document_name": document_name,
        "reason": reason, "detail": detail, "occurred_at": _now(), "reviewed": False,
    })


def list_dead_letter() -> list[dict[str, Any]]:
    return [s.to_dict() for s in db().collection("dead_letter").stream()]


# ---------- briefings ----------

def save_briefing(*, script_text: str, audio_url: str) -> str:
    bid = uuid.uuid4().hex[:12]
    db().collection("daily_briefings").document(bid).set({
        "id": bid,
        "briefing_date": _now().date().isoformat(),
        "script_text": script_text,
        "audio_url": audio_url,
        "generated_at": _now(),
    })
    return bid


def latest_briefing() -> Optional[dict[str, Any]]:
    q = db().collection("daily_briefings").order_by("generated_at", direction=firestore.Query.DESCENDING).limit(1)
    rows = [s.to_dict() for s in q.stream()]
    return rows[0] if rows else None


# ---------- deal memory (Memory Bank fallback, ARCHITECTURE §6) ----------

def read_deal_memory(deal_id: str = "kestrel") -> str:
    snap = db().collection("deal_memory").document(deal_id).get()
    return snap.get("summary") if snap.exists else ""


def write_deal_memory(summary: str, deal_id: str = "kestrel") -> None:
    db().collection("deal_memory").document(deal_id).set({"summary": summary, "updated_at": _now()})
