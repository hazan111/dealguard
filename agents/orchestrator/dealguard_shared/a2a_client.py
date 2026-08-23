"""Minimal A2A client used by the Orchestrator to call specialists.

Two transports, selected by URL:
- Plain A2A JSON-RPC (`message/send`) for self-hosted A2A servers (local dev).
- Agent Engine's A2A HTTP+JSON surface (`.../a2a/v1/message:send` + task
  polling) for agents deployed on Vertex AI Agent Engine.

Both honor the failure-tolerance contract from ARCHITECTURE §2a: bounded
timeout, one retry, idempotency key on the message.
"""
import json
import time
import uuid
from typing import Optional

import httpx


class A2AError(Exception):
    pass


def _is_agent_engine(url: str) -> bool:
    return "aiplatform.googleapis.com" in url and "/reasoningEngines/" in url


def _gcp_token() -> str:
    import google.auth
    import google.auth.transport.requests
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def _ae_send(url: str, text: str, *, timeout_s: float, idempotency_key: Optional[str]) -> str:
    """Agent Engine HTTP+JSON A2A: send, then poll the (persistent) task."""
    headers = {"Authorization": f"Bearer {_gcp_token()}", "Content-Type": "application/json"}
    deadline = time.monotonic() + timeout_s
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{url}/a2a/v1/message:send", headers=headers, json={
            "message": {
                "role": "ROLE_USER",
                "messageId": idempotency_key or uuid.uuid4().hex,
                "content": [{"text": text}],
            },
        })
        resp.raise_for_status()
        task = resp.json().get("task", {})
        task_id = task.get("taskId") or task.get("id")
        if not task_id:
            raise A2AError(f"Agent Engine A2A send returned no task id: {resp.text[:300]}")
        while True:
            state = ((task.get("status") or {}).get("state")) or ""
            if state in ("TASK_STATE_COMPLETED", "completed"):
                break
            if state in ("TASK_STATE_FAILED", "TASK_STATE_CANCELLED", "TASK_STATE_REJECTED",
                         "failed", "canceled", "rejected"):
                raise A2AError(f"Agent Engine A2A task ended in {state}")
            if time.monotonic() > deadline:
                raise A2AError(f"Agent Engine A2A task timed out after {timeout_s}s (state={state})")
            time.sleep(2)
            poll = client.get(f"{url}/a2a/v1/tasks/{task_id}", headers=headers)
            poll.raise_for_status()
            task = poll.json().get("task", poll.json())
    parts = []
    for artifact in task.get("artifacts") or []:
        parts.extend(artifact.get("content") or artifact.get("parts") or [])
    if not parts:
        history = task.get("history") or []
        for message in reversed(history):
            if message.get("role") in ("ROLE_AGENT", "agent"):
                parts = message.get("content") or []
                break
    text_out = "\n".join(p.get("text", "") for p in parts if p.get("text"))
    if not text_out.strip():
        raise A2AError(f"Agent Engine A2A task completed with no text output: {json.dumps(task)[:400]}")
    return text_out


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
            if _is_agent_engine(url):
                return _ae_send(url, text, timeout_s=timeout_s,
                                idempotency_key=idempotency_key)
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
