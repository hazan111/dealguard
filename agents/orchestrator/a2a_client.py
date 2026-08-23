"""Minimal A2A JSON-RPC client used by the Orchestrator to call specialists.

Uses the raw `message/send` JSON-RPC shape (stable across a2a-sdk versions),
with the failure-tolerance contract from ARCHITECTURE §2a: bounded timeout,
one retry, idempotency key on the message metadata.
"""
import json
import uuid
from typing import Optional

import httpx


class A2AError(Exception):
    pass


def _extract_text(result: dict) -> str:
    """Pull concatenated text parts out of an A2A Message or Task result."""
    parts = []
    if result.get("kind") == "message" or "parts" in result:
        parts = result.get("parts", [])
    else:  # Task
        for artifact in result.get("artifacts") or []:
            parts.extend(artifact.get("parts") or [])
        if not parts:
            status_msg = (result.get("status") or {}).get("message") or {}
            parts = status_msg.get("parts") or []
    texts = [p.get("text", "") for p in parts if p.get("kind") == "text" or "text" in p]
    return "\n".join(t for t in texts if t)


def a2a_send(url: str, text: str, *, timeout_s: float = 120.0,
             idempotency_key: Optional[str] = None, retries: int = 1) -> str:
    """Send one user message to an A2A agent, return the agent's text reply.

    Raises A2AError after `retries + 1` failed attempts.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": uuid.uuid4().hex,
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "kind": "message",
                "messageId": idempotency_key or uuid.uuid4().hex,
                "parts": [{"kind": "text", "text": text}],
            },
        },
    }
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=timeout_s) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                body = resp.json()
            if "error" in body:
                raise A2AError(f"A2A error from {url}: {body['error']}")
            result = body.get("result") or {}
            state = ((result.get("status") or {}).get("state")) if result.get("kind") == "task" else None
            if state and state not in ("completed",):
                raise A2AError(f"A2A task ended in state={state}: {json.dumps(result)[:500]}")
            text_out = _extract_text(result)
            if not text_out.strip():
                raise A2AError(f"A2A reply from {url} contained no text")
            return text_out
        except Exception as exc:  # noqa: BLE001 — every failure type retries once, then escalates
            last_error = exc
    raise A2AError(f"A2A call to {url} failed after {retries + 1} attempts: {last_error}")
