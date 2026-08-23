"""DealGuard dashboard backend — the only surface the frontend talks to.

All Firestore access goes through here (never directly from the frontend) so
the human-only resolve rule is enforced server-side, per TASKLIST Phase 10.
"""
import csv
import hashlib
import io
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dealguard_shared.config import load_dotenv

load_dotenv()

import jwt
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from dealguard_shared import firestore_client as store
from dealguard_shared.config import config

JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_USER = os.environ.get("DASHBOARD_ADMIN_USERNAME", "maya")
ADMIN_HASH = os.environ.get("DASHBOARD_ADMIN_PASSWORD_HASH", "")
GCS_BUCKET = os.environ.get("BRIEFING_BUCKET", f"{os.environ.get('GOOGLE_CLOUD_PROJECT','')}-dealguard")

app = FastAPI(title="DealGuard Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https://.*\.run\.app",
    allow_methods=["*"], allow_headers=["*"],
)

_bearer = HTTPBearer(auto_error=False)


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if creds is None:
        raise HTTPException(401, "missing token")
    try:
        claims = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        return claims["sub"]
    except jwt.PyJWTError as exc:
        raise HTTPException(401, f"invalid token: {exc}") from exc


class LoginRequest(BaseModel):
    username: str
    password: str


class ResolveRequest(BaseModel):
    resolved_by: str


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    ok = (req.username == ADMIN_USER and
          hashlib.sha256(req.password.encode()).hexdigest() == ADMIN_HASH)
    if not ok:
        raise HTTPException(401, "bad credentials")
    token = jwt.encode({"sub": req.username, "iat": int(time.time()),
                        "exp": int(time.time()) + 12 * 3600}, JWT_SECRET, algorithm="HS256")
    return {"token": token}


@app.get("/api/risk-register")
def risk_register(status: str | None = None, user: str = Depends(require_user)):
    findings = store.list_findings(status)
    docs = {s.id: s.to_dict() for s in store.db().collection("documents").stream()}
    for f in findings:
        doc = docs.get(f.get("document_id")) or {}
        f["document_name"] = doc.get("name", "")
        f["drive_url"] = doc.get("drive_url", "")
    return {"findings": findings}


@app.get("/api/summary")
def summary(user: str = Depends(require_user)):
    findings = store.list_findings()
    docs = [s.to_dict() for s in store.db().collection("documents").stream()]
    return {
        "total_findings": len(findings),
        "open_risks": sum(1 for f in findings if f.get("status") == "open"),
        "needs_review": sum(1 for f in findings if f.get("status") in ("needs_review", "under_review")),
        "resolved": sum(1 for f in findings if f.get("status") == "resolved"),
        "documents_processed": len(docs),
        "blocked_injections": sum(1 for d in docs if d.get("model_armor_verdict") == "blocked"),
    }


@app.post("/api/risk-register/{fid}/resolve")
def resolve(fid: str, req: ResolveRequest, user: str = Depends(require_user)):
    # Human-only: this endpoint is only reachable with a human's JWT; agents
    # have no route that can set status=resolved.
    if not store.resolve_finding(fid, req.resolved_by or user):
        raise HTTPException(404, "finding not found")
    store.append_timeline_event(
        event_type="finding_updated",
        description=f"Finding resolved by {req.resolved_by or user} (human sign-off)",
        related_finding_id=fid)
    return {"ok": True}


@app.get("/api/risk-register/export")
def export_csv(user: str = Depends(require_user)):
    findings = store.list_findings()
    buf = io.StringIO()
    fields = ["id", "domain", "severity", "status", "summary", "red_flag_pattern",
              "citation", "citation_verified", "recommended_action",
              "suggested_followup_question", "entities",
              "cross_referenced_finding_ids", "document_id", "created_at",
              "resolved_by", "resolved_at"]
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for f in findings:
        row = dict(f)
        row["entities"] = "; ".join(row.get("entities") or [])
        row["cross_referenced_finding_ids"] = "; ".join(row.get("cross_referenced_finding_ids") or [])
        writer.writerow(row)
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=dealguard-risk-register.csv"})


@app.get("/api/timeline")
def timeline(user: str = Depends(require_user)):
    return {"events": store.list_timeline()}


@app.get("/api/dead-letter")
def dead_letter(user: str = Depends(require_user)):
    return {"items": store.list_dead_letter()}


# ---------- voice briefing ----------

def _briefing_script() -> str:
    from google import genai
    findings = [f for f in store.list_findings() if f.get("status") != "resolved"]
    memory = store.read_deal_memory()
    client = genai.Client(vertexai=True, project=config.project, location=config.gemini_location)
    resp = client.models.generate_content(
        model=config.gemini_model,
        contents=(
            "Write a spoken daily briefing (90-120 words, natural speech, no markdown, "
            "no headings) for Maya Chen, an acquisition entrepreneur, summarizing the "
            "current risk state of her acquisition of Kestrel Robotics. Lead with the "
            "highest-severity open items and any cross-domain links. Current open "
            f"findings (JSON):\n{json.dumps(findings, default=str)[:8000]}\n\n"
            f"Deal memory:\n{memory[:2000]}"
        ))
    return resp.text.strip()


@app.post("/api/briefings/generate")
def generate_briefing(user: str = Depends(require_user)):
    from google.cloud import storage, texttospeech
    script = _briefing_script()
    tts = texttospeech.TextToSpeechClient()
    audio = tts.synthesize_speech(
        input=texttospeech.SynthesisInput(text=script),
        voice=texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name=os.environ.get("TTS_VOICE_NAME", "en-US-Neural2-D")),
        audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3),
    )
    client = storage.Client(project=config.project)
    bucket = client.bucket(GCS_BUCKET)
    if not bucket.exists():
        bucket = client.create_bucket(GCS_BUCKET, location="us-central1")
    bid_blob = f"briefings/{int(time.time())}.mp3"
    bucket.blob(bid_blob).upload_from_string(audio.audio_content, content_type="audio/mpeg")
    bid = store.save_briefing(script_text=script, audio_url=f"gs://{GCS_BUCKET}/{bid_blob}")
    store.append_timeline_event(event_type="voice_briefing_generated",
                                description="Daily voice briefing generated")
    return {"id": bid, "script_text": script}


@app.get("/api/briefings/latest")
def briefings_latest(user: str = Depends(require_user)):
    row = store.latest_briefing()
    return {"briefing": row}


@app.get("/api/briefings/latest/audio")
def briefing_audio(user: str = Depends(require_user)):
    from google.cloud import storage
    row = store.latest_briefing()
    if not row:
        raise HTTPException(404, "no briefing yet")
    gs_url = row["audio_url"]
    bucket_name, _, blob_name = gs_url.removeprefix("gs://").partition("/")
    blob = storage.Client(project=config.project).bucket(bucket_name).blob(blob_name)
    return Response(blob.download_as_bytes(), media_type="audio/mpeg")


# ---------- Schedule of Exceptions (real Google Doc) ----------

@app.post("/api/risk-register/{fid}/draft-exception")
def draft_exception(fid: str, user: str = Depends(require_user)):
    finding = store.get_finding(fid)
    if not finding:
        raise HTTPException(404, "finding not found")

    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    key_path = os.environ.get("DRIVE_SERVICE_ACCOUNT_KEY_PATH", "")
    scopes = ["https://www.googleapis.com/auth/documents",
              "https://www.googleapis.com/auth/drive"]
    if key_path and os.path.isfile(key_path):
        creds = service_account.Credentials.from_service_account_file(key_path, scopes=scopes)
    else:
        import google.auth
        creds, _ = google.auth.default(scopes=scopes)
    docs_api = build("docs", "v1", credentials=creds, cache_discovery=False)

    # Service accounts can no longer own Drive files (no storage quota since
    # 2025), so the doc is created once by the human user and placed in the
    # data-room folder; we discover it by title and append to it.
    doc_id = os.environ.get("SCHEDULE_OF_EXCEPTIONS_DOC_ID", "")
    snap = store.db().collection("settings").document("exceptions_doc").get()
    if not doc_id and snap.exists:
        doc_id = snap.get("doc_id")
    if not doc_id:
        drive_api = build("drive", "v3", credentials=creds, cache_discovery=False)
        hits = drive_api.files().list(
            q=("name contains 'Schedule of Exceptions' and "
               "mimeType = 'application/vnd.google-apps.document' and trashed = false"),
            fields="files(id, name)").execute().get("files", [])
        if not hits:
            raise HTTPException(409, (
                "Schedule of Exceptions doc not found. Create a Google Doc named "
                "'Schedule of Exceptions — Project Kestrel' inside the data-room "
                "folder (or share it with the runtime service account), then retry."))
        doc_id = hits[0]["id"]
        store.db().collection("settings").document("exceptions_doc").set({"doc_id": doc_id})

    entry = (f"\n{finding['domain'].upper()} — {finding.get('red_flag_pattern','')}\n"
             f"{finding['summary']}\n"
             f"Source: {finding.get('citation','')}\n"
             f"Recommended treatment: {finding.get('recommended_action','')}\n")
    docs_api.documents().batchUpdate(documentId=doc_id, body={"requests": [
        {"insertText": {"endOfSegmentLocation": {}, "text": entry}}]}).execute()
    store.append_timeline_event(
        event_type="finding_updated",
        description="Finding drafted into the Schedule of Exceptions Google Doc",
        related_finding_id=fid)
    store.update_finding(fid, {"drafted_to_exceptions": True})
    return {"ok": True, "doc_id": doc_id,
            "doc_url": f"https://docs.google.com/document/d/{doc_id}/edit"}
