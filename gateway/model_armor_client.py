"""Model Armor client — screens document text before any agent reasoning sees it.

Uses the regional REST endpoint directly (verified working on this project;
note the gcloud CLI's global endpoint is NOT accessible here — discovered
2026-08-23, documented for reproducibility).
"""
from dataclasses import dataclass

import google.auth
import google.auth.transport.requests
import httpx

from dealguard_shared.config import config

_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def _access_token() -> str:
    creds, _ = google.auth.default(scopes=_SCOPES)
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


@dataclass
class ArmorVerdict:
    blocked: bool
    matched_filters: list[str]
    raw: dict


# Chunked screening: a short injection embedded in a long, legitimate document
# dilutes the classifier signal — the full-document scan misses what a
# paragraph-sized scan catches (verified empirically on this project: the
# poisoned seed document passes a whole-document scan but its injection chunk
# alone is flagged). So every document is screened both whole AND in
# overlapping chunks; any match blocks.
CHUNK_CHARS = 800
CHUNK_OVERLAP = 100


def _sanitize_once(text: str, token: str) -> dict:
    region = config.region
    url = (
        f"https://modelarmor.{region}.rep.googleapis.com/v1/projects/{config.project}"
        f"/locations/{region}/templates/{config.model_armor_template}:sanitizeUserPrompt"
    )
    resp = httpx.post(
        url,
        json={"userPromptData": {"text": text}},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()["sanitizationResult"]


def _matched_filters(result: dict) -> list[str]:
    matched = []
    for filter_name, filter_result in (result.get("filterResults") or {}).items():
        inner = next(iter(filter_result.values()), {})
        state = inner.get("matchState") or (inner.get("inspectResult") or {}).get("matchState")
        if state == "MATCH_FOUND":
            matched.append(filter_name)
    return matched


def screen_text(text: str) -> ArmorVerdict:
    token = _access_token()
    pieces = [text] + [
        text[max(0, i - CHUNK_OVERLAP): i + CHUNK_CHARS]
        for i in range(0, len(text), CHUNK_CHARS)
    ]
    for piece in pieces:
        result = _sanitize_once(piece, token)
        if result.get("filterMatchState") == "MATCH_FOUND":
            return ArmorVerdict(blocked=True, matched_filters=_matched_filters(result), raw=result)
    return ArmorVerdict(blocked=False, matched_filters=[], raw=result)
