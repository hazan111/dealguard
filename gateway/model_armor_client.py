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


def screen_text(text: str) -> ArmorVerdict:
    region = config.region
    url = (
        f"https://modelarmor.{region}.rep.googleapis.com/v1/projects/{config.project}"
        f"/locations/{region}/templates/{config.model_armor_template}:sanitizeUserPrompt"
    )
    resp = httpx.post(
        url,
        json={"userPromptData": {"text": text}},
        headers={"Authorization": f"Bearer {_access_token()}"},
        timeout=30.0,
    )
    resp.raise_for_status()
    result = resp.json()["sanitizationResult"]
    blocked = result.get("filterMatchState") == "MATCH_FOUND"
    matched = []
    for filter_name, filter_result in (result.get("filterResults") or {}).items():
        inner = next(iter(filter_result.values()), {})
        state = inner.get("matchState") or (inner.get("inspectResult") or {}).get("matchState")
        if state == "MATCH_FOUND":
            matched.append(filter_name)
    return ArmorVerdict(blocked=blocked, matched_filters=matched, raw=result)
