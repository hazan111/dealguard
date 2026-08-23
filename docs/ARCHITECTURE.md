# DealGuard — Architecture

Single source of truth for the agent fleet's data flow, deployment shape, and the exact substitution made for Agent Gateway. Anything not specified here defaults to the simplest reasonable implementation consistent with this document.

---

## 1. Agent Fleet Topology

Five independently deployable agents, each built with ADK (Python), each deployed to its own Vertex AI Agent Engine resource, each registered in Agent Registry, communicating over A2A.

```
                     ┌─────────────────────┐
   Google Drive  ──► │  drive-watcher       │  (Cloud Run — receives Drive push
   "data room"       │  (push notification  │   notifications, fetches new/changed
                      │   receiver)          │   file, hands off to Gateway)
                      └──────────┬───────────┘
                                 │
                                 ▼
                     ┌─────────────────────┐
                     │  gateway (Cloud Run) │  ◄── Agent Gateway SUBSTITUTE
                     │  - calls Model Armor │      (real Agent Gateway is
                     │    to screen content │       Private Preview, inaccessible)
                     │  - classifies doc,   │
                     │    routes to agent   │
                     └──────────┬───────────┘
                                 │  A2A
                                 ▼
                     ┌─────────────────────┐
                     │  Orchestrator Agent  │ (Agent Engine)
                     └──┬────┬────┬────┬────┘
              A2A       │    │    │    │      A2A
          ┌─────────────┘    │    │    └─────────────┐
          ▼                  ▼    ▼                   ▼
   ┌─────────────┐   ┌─────────────┐  ┌─────────────┐ ┌─────────────┐
   │ Legal Risk  │   │ Financial   │  │ HR/Comp     │ │ IP Risk     │
   │ Agent       │   │ Risk Agent  │  │ Risk Agent  │ │ Agent       │
   └─────────────┘   └─────────────┘  └─────────────┘ └─────────────┘
          all four write findings back to the Orchestrator via A2A,
          which persists them to Firestore (risk register) and updates
          the deal's Memory Bank / session context
```

## 1a. Grounding the Four Specialist Agents in Real Due-Diligence Practice

The four specialist agents are not arbitrary domain labels — they mirror the standard division of labor on a real M&A deal team (CFO/finance lead, general counsel/legal lead, HR lead, and a technical/IP lead), and each agent's system instructions should explicitly reference the recognized red-flag patterns for its domain rather than reasoning from scratch each time:

- **Legal Risk Agent:** change-of-control termination rights in material contracts, pending/undisclosed litigation, corporate-organization gaps.
- **Financial Risk Agent:** customer/revenue concentration (the widely used **20–25% single-customer threshold** is the reference point — findings above this should explicitly cite it), debt covenants, earnings-quality irregularities.
- **HR/Compensation Risk Agent:** golden-parachute/change-of-control compensation triggers, key-person dependency risk, benefits/retention exposure.
- **IP Risk Agent:** missing or incomplete IP assignment agreements (a very common real finding: IP created by an individual — e.g. a founder/CTO — without a signed assignment to the company may legally still belong to that individual, not the business being acquired), licensing gaps.

Every finding a specialist agent produces should, where applicable, name the specific recognized red-flag pattern it matches (not just "this seems risky") — this is what separates a grounded finding from a generic LLM guess, and it's a deliberate instruction to bake into each agent's prompt, not an incidental nice-to-have.

## 2. Why Five Separate Agents, Not One Multi-Agent Script

The track explicitly asks for agents "cataloged for cross-department use" and a network that can be discovered/governed independently. A single ADK app with internal sub-agents would satisfy the *behavior* but not the *governance story* — Agent Registry's value (independent discovery, independent identity, independent versioning per department) only shows up if the agents are genuinely separate deployments. This is a deliberate, deployment-time decision, not a purely code-organization one. It's also the right answer to the official judging question "is the task complex enough to warrant a multi-agent system, and does it intelligently delegate to specialized sub-agents?" — for a solo acquisition entrepreneur with no in-house legal/finance/HR/IP staff, the actual gap being filled is four distinct kinds of specialist judgment running in parallel, not a single reviewer who just needs to read faster.

## 2a. Failure Tolerance — What Happens When a Worker Agent Loops or Hallucinates

This is a named judging question for this track ("how does the system recover if a worker agent loops or returns a hallucination?") and is treated as a first-class design contract, not an afterthought:

| Failure mode | System behavior |
|---|---|
| Specialist call times out | Hard timeout, one bounded retry, then escalate |
| Agent enters a loop | Max-turns / execution-budget limit forcibly terminates the run |
| Structured output fails schema validation | Reject, retry once with the validation error fed back to the agent |
| A finding's citation can't be verified against the source document text | The finding is **not** written to the risk register as confirmed — it's routed to a `needs_review` state instead. This is the concrete hallucination-recovery mechanism: an agent claiming "the contract says X" where X isn't actually in the cited passage never silently becomes an accepted finding. |
| Specialist fails twice on the same document | Routed to a dead-letter / human-review queue rather than dropped silently |
| A2A call to a specialist is unavailable | Exponential backoff retry, using an idempotency key so a retried call can't create a duplicate finding |
| Duplicate Drive change notification for the same file/version | De-duplicated by document ID + content hash — not reprocessed |
| Two specialists produce conflicting findings about the same fact | The Orchestrator does **not** silently resolve the conflict itself — it creates a flagged `conflicting_findings` entry for human review, exactly like any other risk that needs a human call |

The citation-verification rule above is the one most worth demonstrating live in the demo video: an agent producing an unsupported claim gets caught before it reaches the risk register, not after.

## 3. Agent Gateway Substitution — Full Disclosure

Google's Agent Gateway could not be enabled on the verified project (absent from `gcloud services list --available` in two separate scans; no self-serve enable path found — consistent with its documented Private Preview status). The `gateway/` Cloud Run service in this repo performs the same **conceptual** job at a small scale:
- Receives the new/changed document reference from `drive-watcher`.
- Calls **Model Armor** (`gcloud model-armor` / REST API — this component IS real and accessible) to screen the document content for prompt injection and PII before any agent reasoning touches it.
- Classifies the document type (a lightweight Gemini call) and forwards it to the Orchestrator Agent over A2A.
- Logs every routing decision (for the Observability story).

This is explicitly a **substitute**, not a re-implementation claiming to be the real thing — the README, the submission text, and the demo video all say so plainly.

## 4. Data Model (Firestore)

### `documents`
| Field | Type | Notes |
|---|---|---|
| id | string | Drive file ID |
| name | string | |
| drive_url | string | |
| category | string | `legal` \| `financial` \| `hr` \| `ip` \| `unclassified` |
| ingested_at | timestamp | |
| model_armor_verdict | string | `clean` \| `blocked` — plus the raw finding if blocked |
| routed_to_agent | string | which specialist agent handled it |

### `risk_findings`
| Field | Type | Notes |
|---|---|---|
| id | string | |
| document_id | string | FK → `documents` |
| domain | string | `legal` \| `financial` \| `hr` \| `ip` |
| summary | string | human-readable finding |
| citation | string | page/section reference back to the source document |
| severity | string | `low` \| `medium` \| `high` |
| recommended_action | string | `re-trade` \| `escrow` \| `indemnity` \| `walk-away` \| `monitor` — the standard M&A workstream taxonomy for how a finding typically gets resolved into deal terms; the agent suggests one, a human decides |
| suggested_followup_question | string, nullable | a question the Orchestrator suggests sending to the seller to clarify or resolve this finding — mirrors the "follow-up diligence question" step real deal teams do |
| status | string | `open` \| `under_review` \| `resolved` — **only a human can set `resolved`, never an agent** |
| cross_referenced_finding_ids | array<string> | other findings this one relates to/updates — this is what the Orchestrator populates when a later document changes an earlier assessment |
| created_at | timestamp | |
| resolved_by | string, nullable | human reviewer name/id |
| resolved_at | timestamp, nullable | |

### `deal_timeline`
| Field | Type | Notes |
|---|---|---|
| id | string | |
| event_type | string | `document_ingested` \| `finding_created` \| `finding_updated` \| `model_armor_block` \| `voice_briefing_generated` |
| description | string | |
| related_document_id | string, nullable | |
| related_finding_id | string, nullable | |
| occurred_at | timestamp | |

### `daily_briefings`
| Field | Type | Notes |
|---|---|---|
| id | string | |
| briefing_date | date | |
| script_text | string | the text that was turned into speech |
| audio_url | string | Cloud Storage path to the generated audio file |
| generated_at | timestamp | |

## 5. Deploying an Agent to Agent Engine (pattern used for all five)

Each `agents/<name>/deploy.py` follows this shape (verified working against the live project via `agent_engines.list()`):

```python
import vertexai
from vertexai import agent_engines
from agent import root_agent  # the ADK agent defined in agent.py

vertexai.init(project="<GOOGLE_CLOUD_PROJECT>", location="us-central1")

remote_agent = agent_engines.create(
    root_agent,
    requirements=["google-cloud-aiplatform[adk,agent_engines]"],
    display_name="dealguard-<agent-name>",
)
print(remote_agent.resource_name)  # save this into .env as <NAME>_AGENT_ENGINE_ID
```

After deploying, register each agent's resource name in **Agent Registry** (`agentregistry.googleapis.com`) so it shows up in the fleet catalog — exact registration call to be confirmed against the Agent Registry API reference at build time (the API was only confirmed enabled, not yet exercised end-to-end at the time of writing this document).

## 6. Memory Bank / Session Context

Attempt first: use Agent Engine's built-in session/memory mechanism (accessible through the same `vertexai.agent_engines` SDK already verified working) to persist per-deal context across the weeks-long timeline — this is the "try the real thing first" decision locked earlier.

**Fallback (use and disclose if the built-in mechanism doesn't fit):** a `deal_memory` Firestore collection keyed by a `deal_id`, storing a running summary the Orchestrator reads before processing each new document and rewrites after — deliberately simple, not a vector store, since the deal's context (a running risk register) is inherently structured, not free text requiring semantic search.

## 7. Model Armor Integration

Configured via `gcloud model-armor templates create` (or the REST API equivalent) with a template that screens for: prompt injection patterns, PII (names, SSNs/national IDs, account numbers), and jailbreak attempts. The `gateway/model_armor_client.py` module calls this template synchronously before any document content is passed to the Orchestrator. A blocked verdict is logged to `deal_timeline` as a `model_armor_block` event and surfaced immediately on the dashboard — this is the "poisoned document" demo moment.

## 8. Google Drive Ingestion (push notifications)

`drive-watcher` sets up a Drive API **watch channel** on the data-room folder (`files.watch` on the folder, or a `changes.watch` scoped to that folder's contents) at startup. Google sends a POST to the watcher's Cloud Run endpoint whenever a file is added/changed. The watcher fetches the file, computes a stable `document_id`, and hands it to the gateway. Watch channels expire (max ~7 days per Drive API limits) — the watcher must renew the channel before expiry; for the hackathon's timeframe this is a simple renewal cron, not a production-grade renewal system.

## 9. Daily Voice Briefing (Multimodal UX bonus)

A scheduled job (or a manual "Generate briefing" button on the dashboard for demo purposes, since waiting for a real daily cron isn't practical live) has the Orchestrator produce a short natural-language summary of the day's findings, which is converted to speech via Cloud Text-to-Speech (voice: `en-US-Neural2-D`, or Gemini's native audio output if available and simpler to wire up — whichever is actually used should be stated in the submission). The resulting audio file is stored in Cloud Storage and referenced from `daily_briefings.audio_url`; the dashboard's `VoiceBriefingPlayer.tsx` component plays it.

## 10. Agent Observability

Each agent emits standard OpenTelemetry traces (ADK's built-in instrumentation) which `observability.googleapis.com` should pick up once the agents are deployed to Agent Engine — this needs to be exercised end-to-end during the build (deploy one agent, confirm a trace appears) rather than assumed; if it doesn't surface automatically, a minimal custom trace/log write to Cloud Logging from each agent is the fallback, disclosed as such.

## 11. REST API (dashboard-facing, under `/api`)

- `POST /api/auth/login` — same JWT pattern as FieldOps.
- `GET /api/risk-register?status=open` — all findings, joined with document + agent info.
- `POST /api/risk-register/:id/resolve` — human-only action, requires `resolved_by`.
- `GET /api/timeline?deal_id=` — the `deal_timeline` feed for the audit-trail screen.
- `GET /api/briefings/latest` — most recent `daily_briefings` row, including `audio_url`.
- `POST /api/briefings/generate` — manually trigger a briefing generation (used live in the demo instead of waiting for the scheduled job).
- `GET /api/risk-register/export?format=csv` — exports the current risk register (all fields including `recommended_action` and `suggested_followup_question`) as a downloadable file, so the deal team can drop it into their own IC memo or deck. This is a deliberate, cheap addition closing a real gap versus commercial tools in this category, which typically offer exactly this kind of export.
- `POST /api/risk-register/:id/draft-exception` — has the Orchestrator draft/update an entry in a real Google Doc acting as the deal's **Schedule of Exceptions** (a genuine M&A artifact: findings that get disclosed on a schedule so the seller isn't liable for them, rather than fixed or walked away from). This is the agent completing real deal-workflow output, not just analysis — the difference between a reporting tool and a Taskmaster-style agent that "does something."
