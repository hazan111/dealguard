"""DealGuard drive-watcher — watches the Google Drive "data room" folder.

Two ingestion modes:
- Push (production / Cloud Run): a Drive API watch channel POSTs to /notifications
  whenever the folder changes (real-time, not polling). Channels expire (~7 days
  max); /watch/renew re-registers — a simple renewal hook, per ARCHITECTURE §8.
- Poll (local dev fallback): a background loop scans the folder every
  POLL_INTERVAL_S seconds, since Drive push cannot reach localhost.

Either path converges on scan_folder(): list files → download/extract text →
hand off to the Gateway. De-duplication is enforced downstream by document ID +
content hash, so duplicate notifications are harmless.
"""
import asyncio
import io
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dealguard_shared.config import load_dotenv

load_dotenv()

import httpx
from fastapi import FastAPI, Request, Response
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pypdf import PdfReader

from dealguard_shared.config import config

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://127.0.0.1:8080")
POLL_INTERVAL_S = float(os.environ.get("POLL_INTERVAL_S", "0"))
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")  # this service's own https URL, for push channels
CHANNEL_TOKEN = os.environ.get("DRIVE_WATCH_CHANNEL_TOKEN", "")

app = FastAPI(title="DealGuard drive-watcher")

_seen: dict[str, str] = {}  # file_id -> md5/version marker (fast-path only; real dedup is downstream)


def _drive():
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    key_path = os.environ.get("DRIVE_SERVICE_ACCOUNT_KEY_PATH", "")
    if key_path and os.path.isfile(key_path):
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_file(key_path, scopes=scopes)
    else:  # Cloud Run: the runtime service account via ADC
        import google.auth
        creds, _ = google.auth.default(scopes=scopes)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _extract_text(name: str, mime: str, blob: bytes) -> str:
    if mime == "application/pdf" or name.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(blob))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return blob.decode("utf-8", errors="replace")


def _download(drive, file: dict) -> bytes:
    if file["mimeType"].startswith("application/vnd.google-apps"):
        data = drive.files().export(fileId=file["id"], mimeType="text/plain").execute()
        return data if isinstance(data, bytes) else data.encode()
    request = drive.files().get_media(fileId=file["id"])
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()


def scan_folder() -> list[dict]:
    """Scan the data room, push any new/changed file to the Gateway."""
    drive = _drive()
    results = []
    page_token = None
    while True:
        resp = drive.files().list(
            q=f"'{config.drive_folder_id}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, mimeType, md5Checksum, version, webViewLink)",
            pageToken=page_token).execute()
        for file in resp.get("files", []):
            marker = file.get("md5Checksum") or file.get("version", "")
            if _seen.get(file["id"]) == marker:
                continue
            try:
                blob = _download(drive, file)
                text = _extract_text(file["name"], file["mimeType"], blob)
                r = httpx.post(f"{GATEWAY_URL}/ingest", json={
                    "document_id": file["id"],
                    "name": file["name"],
                    "drive_url": file.get("webViewLink", ""),
                    "text": text,
                }, timeout=600.0)
                r.raise_for_status()
                outcome = r.json()
                _seen[file["id"]] = marker
                results.append({"file": file["name"], "result": outcome})
            except Exception as exc:  # noqa: BLE001 — one bad file must not kill the scan
                results.append({"file": file["name"], "error": str(exc)[:300]})
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return results


@app.get("/healthz")
def healthz():
    return {"ok": True, "mode": "push" if PUBLIC_URL else ("poll" if POLL_INTERVAL_S else "manual")}


@app.post("/notifications")
async def notifications(request: Request):
    """Drive push notification receiver."""
    if CHANNEL_TOKEN and request.headers.get("X-Goog-Channel-Token") != CHANNEL_TOKEN:
        return Response(status_code=403)
    state = request.headers.get("X-Goog-Resource-State", "")
    if state == "sync":  # channel handshake
        return {"ok": True}
    results = await asyncio.to_thread(scan_folder)
    return {"ok": True, "processed": results}


@app.post("/scan")
async def manual_scan():
    """Manual trigger (used in local dev and as a demo safety valve)."""
    return {"processed": await asyncio.to_thread(scan_folder)}


@app.post("/watch/renew")
def watch_renew():
    """(Re-)register the Drive watch channel pointing at PUBLIC_URL/notifications."""
    if not PUBLIC_URL:
        return {"error": "PUBLIC_URL not set — push mode disabled"}
    drive = _drive()
    channel = drive.files().watch(fileId=config.drive_folder_id, body={
        "id": uuid.uuid4().hex,
        "type": "web_hook",
        "address": f"{PUBLIC_URL}/notifications",
        "token": CHANNEL_TOKEN,
    }).execute()
    return {"channel": channel}


@app.on_event("startup")
async def startup():
    if PUBLIC_URL:
        try:
            watch_renew()
        except Exception as exc:  # noqa: BLE001 — fall back to poll/manual rather than crash
            print(f"watch registration failed: {exc}")
    if POLL_INTERVAL_S > 0:
        async def poll_loop():
            while True:
                try:
                    await asyncio.to_thread(scan_folder)
                except Exception as exc:  # noqa: BLE001
                    print(f"poll error: {exc}")
                await asyncio.sleep(POLL_INTERVAL_S)
        asyncio.create_task(poll_loop())
