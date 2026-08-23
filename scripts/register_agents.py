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

AE_BASE = "https://us-central1-aiplatform.googleapis.com/v1beta1"

# (display name, A2A endpoint, description) per agent. Endpoints come from the
# deployed Agent Engine resource names in .env; the card is constructed here
# because the AE card route serves the executor, not the static card.
AGENTS = {
    "orchestrator": ("dealguard_orchestrator",
                     f"{AE_BASE}/{os.environ.get('ORCHESTRATOR_AGENT_ENGINE_ID','')}",
                     "DealGuard orchestrator: routes due-diligence documents to specialist risk agents over A2A, verifies citations, links cross-domain findings, maintains the risk register."),
    "legal-risk": ("legal_risk_agent",
                   f"{AE_BASE}/{os.environ.get('LEGAL_AGENT_ENGINE_ID','')}",
                   "M&A legal due-diligence specialist: change-of-control clauses, adverse termination terms, litigation."),
    "financial-risk": ("financial_risk_agent",
                       f"{AE_BASE}/{os.environ.get('FINANCIAL_AGENT_ENGINE_ID','')}",
                       "M&A financial due-diligence specialist: revenue concentration, debt covenants, earnings quality."),
    "hr-risk": ("hr_risk_agent",
                f"{AE_BASE}/{os.environ.get('HR_AGENT_ENGINE_ID','')}",
                "M&A HR/compensation due-diligence specialist: golden parachutes, key-person dependency, retention."),
    "ip-risk": ("ip_risk_agent",
                f"{AE_BASE}/{os.environ.get('IP_AGENT_ENGINE_ID','')}",
                "M&A IP due-diligence specialist: assignment gaps, ownership chains, licensing risk."),
}


def token() -> str:
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def main() -> None:
    headers = {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}
    for name, (agent_name, endpoint, description) in AGENTS.items():
        card = {
            "name": agent_name,
            "description": description,
            "url": endpoint,
            "version": "0.1.0",
            "protocolVersion": "0.3.0",
            "preferredTransport": "HTTP+JSON",
            "capabilities": {"streaming": False},
            "defaultInputModes": ["text/plain"],
            "defaultOutputModes": ["text/plain"],
            "skills": [],
        }
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
