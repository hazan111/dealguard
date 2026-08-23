"""Orchestrator Agent — a deterministic ADK custom agent (BaseAgent).

The orchestration contract (routing, retries, citation verification,
dead-lettering, conflict flagging) is deliberately deterministic code, not an
LLM free-running over tools: the failure-tolerance guarantees of ARCHITECTURE
§2a must hold on every document, not probabilistically. Gemini is used inside
the pipeline where judgment is needed (cross-domain relation decisions).
"""
import json
import os
import sys
from typing import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types as genai_types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dealguard_shared.config import load_dotenv

load_dotenv()

import pipeline  # noqa: E402


class OrchestratorAgent(BaseAgent):
    """Receives one document payload (JSON) over A2A, runs the pipeline,
    replies with the processing result (JSON)."""

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        raw = ""
        if ctx.user_content and ctx.user_content.parts:
            raw = "\n".join(p.text for p in ctx.user_content.parts if p.text)
        try:
            payload = json.loads(raw)
            result = pipeline.process_document(payload)
        except json.JSONDecodeError:
            result = {"status": "error", "error": "payload must be a JSON object"}
        except Exception as exc:  # noqa: BLE001 — the A2A caller needs the failure, not a hang
            result = {"status": "error", "error": f"{type(exc).__name__}: {exc}"[:1000]}
        yield Event(
            author=self.name,
            content=genai_types.Content(
                role="model",
                parts=[genai_types.Part(text=json.dumps(result))],
            ),
        )


root_agent = OrchestratorAgent(
    name="dealguard_orchestrator",
    description=(
        "DealGuard orchestrator: routes due-diligence documents to specialist risk "
        "agents over A2A, verifies citations, links cross-domain findings, maintains "
        "the deal's risk register and timeline."
    ),
)
