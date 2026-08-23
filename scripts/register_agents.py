"""Registers all five DealGuard agents in Agent Registry (TASKLIST Phase 4).

Discovered API shape (exercised live against this project, 2026-08-23):
- Registration is `services.create` with agentSpec.type=A2A_AGENT_CARD and the
  agent's A2A card as content (connection URL lives INSIDE the card; the
  top-level `interfaces` field must be empty for this type).
- The registry materializes a read-only Agent resource (URN id) from the card.

Usage: .venv/bin/python scripts/register_agents.py
Env: <NAME>_CARD_URL overrides where each agent's live card is fetched from.
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import httpx

from dealguard_shared.config import load_dotenv

load_dotenv()

import google.auth
import google.auth.transport.requests

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
REGION = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")
BASE = f"https://agentregistry.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}"

AGENTS = {
    "orchestrator": os.environ.get("ORCHESTRATOR_CARD_URL", "http://127.0.0.1:8100"),
    "legal-risk": os.environ.get("LEGAL_CARD_URL", "http://127.0.0.1:8101"),
    "financial-risk": os.environ.get("FINANCIAL_CARD_URL", "http://127.0.0.1:8102"),
    "hr-risk": os.environ.get("HR_CARD_URL", "http://127.0.0.1:8103"),
    "ip-risk": os.environ.get("IP_CARD_URL", "http://127.0.0.1:8104"),
}


def token() -> str:
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def main() -> None:
    headers = {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}
    for name, base_url in AGENTS.items():
        card = httpx.get(f"{base_url}/.well-known/agent-card.json", timeout=15).json()
        # The card's advertised URL must be the canonical reachable endpoint.
        card["url"] = base_url
        if "supportedInterfaces" in card:
            for iface in card["supportedInterfaces"]:
                iface["url"] = base_url
        service_id = f"dealguard-{name}"
        # idempotent: delete an existing registration first, then recreate
        httpx.delete(f"{BASE}/services/{service_id}", headers=headers, timeout=30)
        time.sleep(2)
        resp = httpx.post(
            f"{BASE}/services?serviceId={service_id}",
            headers=headers,
            json={
                "displayName": f"dealguard-{name}",
                "description": card.get("description", ""),
                "agentSpec": {"type": "A2A_AGENT_CARD", "content": card},
            },
            timeout=30,
        )
        print(service_id, "->", resp.status_code, resp.text[:120].replace("\n", " "))
    time.sleep(5)
    listing = httpx.get(f"{BASE}/agents", headers=headers, timeout=30).json()
    print("\nRegistry now contains:")
    for agent in listing.get("agents", []):
        print(" -", agent.get("displayName"), "|", agent.get("agentId"))


if __name__ == "__main__":
    main()
