# DealGuard

**Tagline:** A solo acquisition entrepreneur shouldn't need a Fortune 500 deal team to diligence their first acquisition.

DealGuard is a multi-agent M&A due-diligence system built for the **All Things Agentic Hackathon**, **Fortified Enterprise Fleet** track. It watches a live "data room" (a shared Google Drive folder), routes each incoming document to the right specialist risk agent (Legal, Financial, HR/Compensation, IP), synthesizes findings into a single evolving risk register over the weeks a deal takes to close, and does all of this on real Gemini Enterprise Agent Platform infrastructure — not a simulation of it.

Built solo. Public repo. English throughout.

---

## 1. Problem & Users

**Target user:** An **acquisition entrepreneur** (a "searcher," in search-fund terminology) — an individual who raises capital to find, acquire, and run a single privately held company, without the in-house legal, finance, HR, and IP departments a corporate acquirer would have. Diligence generates hundreds of documents over weeks; a searcher doing this largely alone (alongside outside counsel and advisors they pay for by the hour, not by the department) has no single view of the full picture, cross-references get missed, and there's no institutional record of who reviewed what or why a risk was cleared. A large corporate acquirer can absorb this with headcount; a solo searcher cannot — which is exactly why a governed agent fleet standing in for the deal team they don't have is valuable here in a way it wouldn't be for a company that already has one.

**Core pain points this solves:**
1. Documents arrive continuously over weeks; nobody is tracking the full picture in real time — and a solo searcher has no team to divide the work across.
2. Risks that only become visible when two documents from different domains (legal + financial, say) are read together are easy to miss when each domain is reviewed in isolation, which is the default for a searcher without dedicated in-house specialists.
3. Diligence data is extremely sensitive (non-public deal information) — any tool touching it must be provably access-controlled and resistant to malicious content embedded in submitted documents (prompt injection).
4. There is no institutional record proving which agent/reviewer saw what, when, and why a finding was accepted or dismissed.

**Demo scenario:** A fictional acquisition — Maya Chen, an acquisition entrepreneur running Solvane Search Partners, pursuing Kestrel Robotics, a profitable lower-middle-market warehouse-automation company. Full detail in [`SCENARIO.md`](./SCENARIO.md).

---

## 2. What Makes This a "Fleet," Not a Chatbot

Five independently deployed, independently registered agents — not one script with internal branching:

1. **Orchestrator Agent** — routes incoming documents, synthesizes cross-domain findings, maintains the evolving risk register.
2. **Legal Risk Agent** — change-of-control clauses, adverse termination terms, pending litigation.
3. **Financial Risk Agent** — revenue concentration, debt covenants, financial irregularities.
4. **HR/Compensation Risk Agent** — golden parachute clauses, key-person dependency risk.
5. **IP Risk Agent** — patent/trademark ownership gaps, licensing risk.

Each agent is its own deployable unit, communicating over the **A2A (Agent-to-Agent) protocol**, each independently registered in **Agent Registry** — this is deliberate: the track explicitly asks for agents "cataloged for cross-department use," which a single monolithic multi-agent script would not genuinely demonstrate. For a solo acquisition entrepreneur, these five agents are standing in for the legal, finance, HR, and IP departments a corporate acquirer would have in-house — not a nice-to-have, but the actual substitute for headcount they don't have.

---

## 3. Verified Google Cloud / Gemini Enterprise Agent Platform Access

Before committing to this architecture, access to every relevant platform component was verified directly against a real Google Cloud project (not assumed from documentation). Results:

**End-of-build status (what actually shipped, verified live — see `ARCHITECTURE.md` §12 for the full discovery log):**

| Component | Status | How it's used here |
|---|---|---|
| **Agent Registry** | ✅ **In production use** | All 5 agents appear in the registry. Two paths verified live: manual `services.create` with `agentSpec.type=A2A_AGENT_CARD`, and — better — the platform **auto-registers** A2A agents deployed on Agent Engine (`aiplatform:reasoningEngines` URNs). The shipped fleet uses the auto-registered entries. |
| **Agent Identity** | ✅ **Per-agent identity shipped via dedicated service accounts** | Each of the 5 agents runs under its own service account. Zero-trust at IAM level: only the orchestrator's SA can touch the risk-register Firestore DB; specialist SAs hold conditional access to the A2A task DB only. The `agentidentity.googleapis.com` authProviders surface is enabled/reachable; adopting it beyond IAM SAs is future scope, disclosed in the submission. |
| **Model Armor** | ✅ **In production use** (regional REST endpoint; the gcloud CLI's global endpoint is not accessible on this project) | Screens every document before agent reasoning — whole text AND overlapping chunks, because a short injection inside a long benign document defeats a whole-document scan (verified; see ARCHITECTURE §12.6). Blocked the poisoned seed document live. |
| **Agent Observability** | ✅ Cloud Logging/Trace surface engine logs (used for live debugging during the build) | Reasoning/exec logs per engine; plus DealGuard's own `deal_timeline` audit trail in Firestore. |
| **Agent Runtime (Vertex AI Agent Engine)** | ✅ **All 5 agents deployed and serving** | Deployed with the **native A2A template** (`A2aAgent`) — Agent Engine itself serves each agent's A2A HTTP+JSON endpoint (`{engine}/a2a/v1/message:send` + task polling). Firestore-backed A2A task store (replicas are ephemeral). |
| **Memory Bank** | ✅ Shipped via the disclosed Firestore fallback | `deal_memory` collection: a deterministic running deal summary rewritten after each document. The deal's context is structured (a risk register), so no semantic store is needed — stated plainly, per the plan. |
| **Agent Gateway** | ❌ Private Preview, not accessible — **substituted** (disclosed) | Cloud Run `gateway` service: Model Armor screening → Gemini classification → A2A forward to the Orchestrator on Agent Engine. |

This verification-first approach (rather than assuming platform docs equal project access) is itself part of the Architectural Discipline story for this submission.

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Agent framework | Google ADK (Python) |
| Agent communication | A2A (Agent-to-Agent) protocol between all 5 agents |
| Model | Gemini 3.5 Flash via Vertex AI (per the track's mandatory requirement) |
| Agent hosting | Vertex AI Agent Engine (Agent Runtime) — verified working |
| Custom gateway substitute | Cloud Run service (Python/FastAPI) — routing + Model Armor invocation, since real Agent Gateway is inaccessible |
| Dashboard backend | Python (FastAPI) — same language as the agents, avoids an unnecessary language switch |
| Dashboard frontend | React + Vite + Tailwind CSS + shadcn/ui |
| Data store | Firestore — risk register, document metadata, deal timeline, (fallback) memory store |
| Document ingestion | Google Drive folder ("data room") via Drive API **push notifications** (watch channels), not polling — real-time triggering |
| Daily voice briefing (multimodal bonus) | Gemini audio output or Cloud Text-to-Speech, played from the dashboard |
| Deployment region | `us-central1` (verified working in this project) |
| Repo | Public |
| Language (bot copy, submission, video) | English |

---

## 5. Design System

Cloudflare-dashboard-inspired. Full tokens in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). Summary:
- Dark/graphite left sidebar navigation, light main content area.
- Accent color: orange (~#F6821F).
- Status colors: green (resolved/clear), red (open risk — always visually dominant), gray (under review).
- Card/tile-based summary metrics at the top of the dashboard.
- Clean, sortable/filterable data table for the risk register.
- Font: Inter.

---

## 6. Repository Structure

```
dealguard/
├── docker-compose.yml
├── .env.example
├── LICENSE
├── agents/
│   ├── orchestrator/
│   │   ├── agent.py
│   │   ├── prompts/
│   │   └── Dockerfile
│   ├── legal_risk/
│   │   ├── agent.py
│   │   └── Dockerfile
│   ├── financial_risk/
│   │   ├── agent.py
│   │   └── Dockerfile
│   ├── hr_risk/
│   │   ├── agent.py
│   │   └── Dockerfile
│   └── ip_risk/
│       ├── agent.py
│       └── Dockerfile
├── gateway/
│   ├── main.py            # Cloud Run — custom Agent Gateway substitute
│   ├── model_armor_client.py
│   └── Dockerfile
├── dashboard-backend/
│   ├── main.py             # FastAPI — risk register API, voice briefing endpoint
│   ├── firestore_client.py
│   └── Dockerfile
├── dashboard-frontend/
│   ├── src/
│   │   ├── pages/{Dashboard.tsx,RiskRegister.tsx,AuditTrail.tsx}
│   │   ├── components/{ui/,RiskCard.tsx,SummaryTile.tsx,VoiceBriefingPlayer.tsx}
│   │   └── styles/globals.css
│   ├── tailwind.config.ts
│   └── package.json
├── drive-watcher/
│   └── main.py              # Cloud Run — Drive API push notification receiver
├── scenario/
│   └── seed_documents/      # fictional deal documents used for the demo
└── docs/
    ├── ARCHITECTURE.md
    ├── SCENARIO.md
    ├── SUBMISSION.md
    ├── TASKLIST.md
    └── DESIGN_SYSTEM.md
```

---

## 7. Environment Variables (`.env.example`)

```
# Google Cloud
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_REGION=us-central1

# Gemini
GEMINI_MODEL=gemini-3.5-flash

# Google Drive (data room)
DRIVE_DATA_ROOM_FOLDER_ID=
DRIVE_WATCH_CHANNEL_TOKEN=
DRIVE_SERVICE_ACCOUNT_KEY_PATH=

# Firestore
FIRESTORE_PROJECT_ID=

# Agent Engine (resource names, filled in after each agent is deployed)
ORCHESTRATOR_AGENT_ENGINE_ID=
LEGAL_AGENT_ENGINE_ID=
FINANCIAL_AGENT_ENGINE_ID=
HR_AGENT_ENGINE_ID=
IP_AGENT_ENGINE_ID=

# Model Armor
MODEL_ARMOR_TEMPLATE_ID=

# Dashboard auth
JWT_SECRET=
DASHBOARD_ADMIN_USERNAME=
DASHBOARD_ADMIN_PASSWORD_HASH=

# Text-to-Speech (daily voice briefing)
TTS_VOICE_NAME=en-US-Neural2-D
```

---

## 8. Spin-up Instructions

```bash
git clone <repo-url>
cd dealguard
cp .env.example .env
# fill in GOOGLE_CLOUD_PROJECT and the Drive folder ID at minimum

# authenticate
gcloud auth application-default login

# enable required APIs (idempotent — safe to re-run)
gcloud services enable aiplatform.googleapis.com agentregistry.googleapis.com \
  agentidentity.googleapis.com modelarmor.googleapis.com observability.googleapis.com \
  run.googleapis.com firestore.googleapis.com drive.googleapis.com

# deploy each agent to Agent Engine (see ARCHITECTURE.md §5 for the exact deploy script per agent)
cd agents/orchestrator && python deploy.py && cd ../..
cd agents/legal_risk && python deploy.py && cd ../..
cd agents/financial_risk && python deploy.py && cd ../..
cd agents/hr_risk && python deploy.py && cd ../..
cd agents/ip_risk && python deploy.py && cd ../..

# deploy the gateway substitute and dashboard backend to Cloud Run
gcloud run deploy dealguard-gateway --source=./gateway --region=us-central1
gcloud run deploy dealguard-dashboard-api --source=./dashboard-backend --region=us-central1

# run the dashboard frontend locally for development
cd dashboard-frontend && npm install && npm run dev
```

Full architecture and exact per-agent deploy commands: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Full ordered build plan: [`TASKLIST.md`](./TASKLIST.md).

---

## 8a. Deployed Resources (live project: `gen-lang-client-0930125328`, us-central1)

| Resource | Value |
|---|---|
| Agent Engine — orchestrator | `reasoningEngines/8362895886224719872` (SA: `dealguard-orch@…`) |
| Agent Engine — legal | `reasoningEngines/4489800206686093312` (SA: `dealguard-legal@…`) |
| Agent Engine — financial | see `.env` (redeployed after the parallel-staging fix; SA: `dealguard-financial@…`) |
| Agent Engine — hr | see `.env` (SA: `dealguard-hr@…`) |
| Agent Engine — ip | `reasoningEngines/575046230594289664` (SA: `dealguard-ip@…`) |
| Cloud Run — gateway (Agent Gateway substitute) | `https://dealguard-gateway-894106893022.us-central1.run.app` |
| Cloud Run — drive-watcher | `https://dealguard-drivewatcher-894106893022.us-central1.run.app` |
| Cloud Run — dashboard API | `https://dealguard-dashboardbackend-894106893022.us-central1.run.app` |
| Firestore | named DBs `dealguard` (risk register) + `dealguard-a2a` (A2A task store), us-central1 |
| Model Armor template | `templates/dealguard-screen` (PI/jailbreak LOW_AND_ABOVE + SDP + malicious URI) |
| Drive data room | folder `1PbHPE9dvCUKz8TYhlzlq_0ZJzwNLOHV6` (push watch → drive-watcher) |
| Voice briefing storage | `gs://gen-lang-client-0930125328-dealguard/briefings/` |

Demo runbook: `scripts/demo.sh local|cloud|reset|stop`.

## 9. Responsible Delivery / Disclosures

> DealGuard's agents never issue a final legal, financial, or HR determination. Every finding in the risk register carries a citation back to the source document and page/section, and every finding requires human (the searcher, or the outside counsel/advisors they engage) sign-off before it can be marked resolved — the system recommends, it does not decide. Each specialist agent's data access is scoped by Agent Identity: the Legal agent cannot read HR documents, the Financial agent cannot read IP filings, and so on. Model Armor screens all document content before it reaches agent reasoning, specifically to catch prompt-injection attempts embedded in submitted documents (demonstrated live in the demo video). Agent Gateway — the platform's native policy-enforcement component — was not accessible on this project (Private Preview); a custom substitute was built instead and this substitution is disclosed here and in the Devpost submission rather than presented as the native component.

## 10. Disclosures (AI tools / data sources)

- Gemini 3.5 Flash (via Vertex AI) powers all five agents' reasoning, document classification, and the orchestrator's cross-domain synthesis.
- AI-assisted development tools were used in writing this codebase, consistent with the hackathon rules.
- No pre-existing code from any other project (FieldOps, WMB, Bisatsan, AutoViz, or any other product) is reused — this is a from-scratch build for this hackathon.
- All deal documents (contracts, financials, HR records, patent filings) used in the demo are entirely fictional, written for this project — see `SCENARIO.md`.
