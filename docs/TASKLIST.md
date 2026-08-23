# DealGuard — Master Task List

> **STATUS (2026-08-23):** Phases 0–10 are COMPLETE and verified against the live
> cloud stack (5 agents on Agent Engine speaking native A2A, gateway/watcher/
> dashboard API on Cloud Run, full 6-document scenario run end-to-end in the
> cloud, Model Armor blocking the poisoned document, Schedule of Exceptions
> written to a real Google Doc, voice briefing generated and played).
> Remaining: Phase 11's *Drive drag-and-drop* leg (a human must drop the PDFs —
> service accounts cannot own Drive files; everything downstream is verified),
> Phase 12 formal observability check, Phase 13 video + Devpost + diagram.
> Deviations and discoveries: `ARCHITECTURE.md` §12.


Authoritative, ordered build plan. Work in order — later phases depend on earlier ones. If something seems ambiguous, check `README.md`, `ARCHITECTURE.md`, `SCENARIO.md`, `DESIGN_SYSTEM.md` before assuming.

---

## Phase 0 — GCP Project Preparation

- [ ] Confirm the target Google Cloud project (the one already verified: `agentregistry.googleapis.com`, `agentidentity.googleapis.com`, `modelarmor.googleapis.com`, `observability.googleapis.com`, `aiplatform.googleapis.com` confirmed available/enabled; `agent_engines.list()` confirmed working).
- [ ] Additionally enable: `run.googleapis.com`, `firestore.googleapis.com`, `drive.googleapis.com`, `texttospeech.googleapis.com` (for the voice briefing), `cloudbuild.googleapis.com` (for Cloud Run source deploys).
- [ ] Create a Firestore database in Native mode in `us-central1` if one doesn't already exist (`gcloud firestore databases create --location=us-central1`).
- [ ] Create a Google Drive folder to serve as the "data room." Note its folder ID into `.env` as `DRIVE_DATA_ROOM_FOLDER_ID`.
- [ ] Create a service account with Drive API read access scoped to that folder (share the folder with the service account's email), and download its key — reference it via `DRIVE_SERVICE_ACCOUNT_KEY_PATH`.

## Phase 1 — Repository Scaffolding

- [ ] Create the folder structure exactly as in `README.md` §6.
- [ ] Each `agents/<name>/` directory gets its own `requirements.txt` (`google-cloud-aiplatform[adk,agent_engines]`, plus any agent-specific deps) and a minimal `agent.py`.
- [ ] `gateway/`, `dashboard-backend/`, `drive-watcher/` are each independent Python (FastAPI where an HTTP surface is needed) projects with their own `requirements.txt` and `Dockerfile`.
- [ ] `dashboard-frontend/` initialized via `npm create vite@latest dashboard-frontend -- --template react-ts`, Tailwind + shadcn/ui configured per `DESIGN_SYSTEM.md`.
- [ ] `.env.example` copied verbatim from `README.md` §7. Local `.env` created (gitignored) with real values filled in as they're generated during the build (agent engine IDs, etc. — these don't exist until Phase 4).
- [ ] `LICENSE` (MIT) added at repo root, same as the FieldOps project's license text.

## Phase 2 — Firestore Schema

- [ ] No formal migration system needed (Firestore is schemaless) — but write a `scenario/seed_documents/seed.py` script that, once Phase 6 (scenario documents) exists, inserts the initial `documents`, `risk_findings`, and `deal_timeline` records matching `SCENARIO.md` exactly, so the demo has a consistent starting state to reset to if needed.
- [ ] Implement thin Firestore client wrappers (`firestore_client.py`, duplicated minimally in `dashboard-backend/` and `agents/orchestrator/` — or better, factor into a small shared internal package both import, to avoid two divergent copies of the same read/write logic) for: `create_document_record`, `create_finding`, `update_finding` (cross-referencing), `resolve_finding` (human-only, requires `resolved_by`), `append_timeline_event`, `save_briefing`.

## Phase 3 — Build the Five Agents (ADK)

- [ ] Write `agents/legal_risk/agent.py`: an ADK agent whose system instructions scope it strictly to legal-domain reasoning (change-of-control clauses, adverse termination terms, pending litigation) over document text/context it's given. It should return structured findings (domain, summary, citation, severity) — use ADK's structured output / tool-calling support rather than asking for free-text and parsing it.
- [ ] Write `agents/financial_risk/agent.py`, `agents/hr_risk/agent.py`, `agents/ip_risk/agent.py` following the same pattern, each scoped to its own domain per `README.md` §2.
- [ ] Write `agents/orchestrator/agent.py`: an ADK agent that, given a classified document, delegates to the correct specialist agent over A2A, receives the structured finding back, checks Firestore for any existing findings that might cross-reference (same customer name, same clause type, etc. — a simple keyword/entity match is sufficient for the hackathon scope, not a full semantic-similarity system), writes the finding (new or updated) to Firestore, and appends a `deal_timeline` event.
- [ ] For each agent, write a `deploy.py` following the exact pattern in `ARCHITECTURE.md` §5. Deploy all five, and record each returned `resource_name` into `.env`.
- [ ] Implement the failure-tolerance contract from `ARCHITECTURE.md` §2a on every specialist call the Orchestrator makes: bounded timeout + single retry, max-turns/execution-budget enforcement, schema validation with one retry on failure, and — most importantly — citation verification: before a finding is written to Firestore as confirmed, check that the cited passage actually appears in the source document text; if it doesn't, write it with status `needs_review` instead of `open`, never silently accept an unverifiable claim.
- [ ] Implement the dead-letter/human-review queue for a specialist that fails twice on the same document, and the `conflicting_findings` path for when two specialists produce contradictory findings about the same underlying fact — the Orchestrator flags this for a human, it does not resolve it itself.
- [ ] Implement idempotency keys on A2A calls (so a retried call after a transient failure can't create a duplicate finding) and de-duplication by document ID + content hash on the ingestion side (so a duplicate Drive change notification for the same file/version isn't reprocessed).

## Phase 4 — Register Agents in Agent Registry

- [ ] For each of the five deployed agents, register them in Agent Registry (`agentregistry.googleapis.com`). The exact registration call (REST payload shape) needs to be confirmed against the live Agent Registry API reference at this point in the build — this was verified as *enabled*, not yet exercised end-to-end, so treat the first registration attempt as a discovery step and adjust the payload based on the actual API's response/error messages rather than guessing the schema in advance.
- [ ] Confirm all five agents are visible in the Agent Registry console/API listing before moving on.

## Phase 5 — Agent Identity (zero-trust scoping)

- [x] **Done, and stronger than originally scoped:** each of the five agents runs under its own dedicated service account. Data access is enforced at the **IAM level**, not application code: only the orchestrator's SA holds `datastore.user` on the risk-register database; specialist SAs hold a conditional grant scoped to the `dealguard-a2a` task database only. Verified empirically (2026-08-23): a read of the risk register authenticated as the Legal agent's SA returns `403 PERMISSION_DENIED`; the same identity reads the task store successfully. The remaining application-level layer is content routing only (the gateway decides which classified text is sent to which specialist over A2A). The `agentidentity.googleapis.com` authProviders surface was probed and is reachable; adopting it beyond IAM service accounts is future scope, disclosed in the submission.

## Phase 6 — Model Armor

- [ ] Create a Model Armor template (`gcloud model-armor templates create` or REST equivalent) configured to detect prompt injection and PII. Record the template ID into `.env` as `MODEL_ARMOR_TEMPLATE_ID`.
- [ ] Write `gateway/model_armor_client.py`: a function that submits document text to the Model Armor template and returns a clean/blocked verdict plus details.

## Phase 7 — Gateway (Agent Gateway substitute)

- [ ] Write `gateway/main.py` (FastAPI on Cloud Run): receives a document reference from `drive-watcher`, extracts text (see Phase 8 for document parsing), calls `model_armor_client`, and — if clean — makes a lightweight Gemini call to classify the document into `legal`/`financial`/`hr`/`ip`/`unclassified`, then forwards it to the Orchestrator Agent over A2A. If Model Armor returns `blocked`, write a `model_armor_block` timeline event and do not forward the document further (see `SCENARIO.md` for the exact fallback behavior to implement for the poisoned-document case).
- [ ] Deploy: `gcloud run deploy dealguard-gateway --source=./gateway --region=us-central1`.

## Phase 8 — Drive Watcher & Document Parsing

- [ ] Write `drive-watcher/main.py` (FastAPI on Cloud Run): sets up a Drive API watch channel on `DRIVE_DATA_ROOM_FOLDER_ID` at startup, exposes a webhook endpoint Drive will POST to, and on each notification, lists changed files, downloads new ones, and calls the gateway with the file reference and extracted text (use a simple PDF-text-extraction library — this doesn't need OCR for the hackathon scope, all seed documents are text-based PDFs).
- [x] Watch-channel renewal — **built as manual re-arm, not a cron** (see `ARCHITECTURE.md` §8): the watcher re-registers on startup, and the token-protected `/watch/renew` endpoint is called by `scripts/demo.sh cloud` at the start of each session. Channels expire ~1h (observed); with no scheduler, push lapses between sessions until the script is re-run — disclosed as a limitation in the submission.
- [ ] Deploy: `gcloud run deploy dealguard-drive-watcher --source=./drive-watcher --region=us-central1`.

## Phase 9 — Dashboard Backend

- [ ] Write `dashboard-backend/main.py` implementing the REST API exactly per `ARCHITECTURE.md` §11 (`/api/auth/login`, `/api/risk-register`, `/api/risk-register/:id/resolve`, `/api/risk-register/export`, `/api/timeline`, `/api/briefings/latest`, `/api/briefings/generate`).
- [ ] Extend the Orchestrator's finding-synthesis step to also populate `suggested_followup_question` for each finding — a short, natural question a deal team would actually send to the seller to clarify or resolve it (e.g. "Please confirm whether the Customer X contract's change-of-control clause has ever been waived or amended"). This mirrors a real, expected step in professional due diligence, not just risk-flagging.
- [ ] Implement `/api/risk-register/export` returning a CSV (simplest, universally importable into Excel/decks) of all current findings.
- [ ] Implement `/api/risk-register/:id/draft-exception`: uses the Google Docs API to create (on first call) or append to (on subsequent calls) a real Google Doc titled "Schedule of Exceptions — [Deal Name]", formatted as a numbered list of disclosed findings. This requires the Drive/Docs service account (already set up in Phase 0) to have write access, and a `SCHEDULE_OF_EXCEPTIONS_DOC_ID` stored once the doc is first created. This is the system's one genuine "completes real deal-workflow output" action — prioritize getting this working over polishing other lower-value UI details if time runs short.
- [ ] `/api/briefings/generate`: has the Orchestrator (or a direct Gemini call summarizing the current open findings) produce a short spoken-style script, sends it to Cloud Text-to-Speech, stores the resulting audio in Cloud Storage, and writes a `daily_briefings` row.
- [ ] Deploy: `gcloud run deploy dealguard-dashboard-api --source=./dashboard-backend --region=us-central1`.

## Phase 10 — Dashboard Frontend

- [ ] Build `pages/Dashboard.tsx`: summary tiles (per `DESIGN_SYSTEM.md`) + the voice briefing player + a "Generate briefing" button.
- [ ] Build `pages/RiskRegister.tsx`: the sortable/filterable findings table, with a detail view showing citation + cross-references + the suggested follow-up question + the human-only resolve action. Include an "Export CSV" button calling `/api/risk-register/export`.
- [ ] Build `pages/AuditTrail.tsx`: the reverse-chronological `deal_timeline` feed.
- [ ] Apply the sidebar layout and color tokens from `DESIGN_SYSTEM.md` globally.
- [ ] Wire all pages to the `dashboard-backend` API (no direct Firestore access from the frontend — always through the backend, so the human-only resolve rule is enforced server-side, not just hidden in the UI).

## Phase 11 — Scenario Data & End-to-End Walkthrough

- [ ] Author the six fictional documents described in `SCENARIO.md` (as actual PDF or text files) into `scenario/seed_documents/`, including the hidden prompt-injection text in document #6.
- [ ] Manually walk through the entire demo narrative end-to-end (drop week-1 documents into the real Drive folder, confirm real-time ingestion, confirm cross-domain linking, drop the week-3 document, confirm severity update, drop the poisoned document, confirm the Model Armor block appears on the dashboard, generate a voice briefing) before moving to deployment finalization.

## Phase 12 — Observability Verification

- [ ] After at least one full walkthrough, check whether `observability.googleapis.com` is actually surfacing traces for the deployed agents (per `ARCHITECTURE.md` §10). If not automatic, implement the Cloud Logging fallback and note this plainly in the submission.

## Phase 13 — Documentation & Submission Finalization

- [ ] Fill in the final `.env.example` → real deployment values reference (agent engine IDs, Model Armor template ID, Cloud Run URLs) into a "Deployed Resources" section added to `README.md` at this point.
- [ ] Update `README.md` §3 (the access-verification table) with the *actual* end-of-build results for Memory Bank and Observability (which were marked "attempt/likely" earlier) — replace speculation with what was actually true after building.
- [ ] Prepare the architecture diagram (a rendering of the topology in `ARCHITECTURE.md` §1) as an actual image file for the Devpost submission's required "Architecture Diagram" field.
- [ ] Use `SUBMISSION.md` as the source text for the Devpost form fields.
- [ ] Prepare the ~4-minute demo video per the narrative in `SCENARIO.md`, explicitly including a moment showing Google Cloud Console proof (Agent Registry listing, Cloud Run services running, Agent Engine console) per the hackathon's mandatory requirement.
- [ ] Prepare the bonus-category deliverables: a blog post or short video covering how DealGuard was built (must be public, must state it was created for this hackathon), and a social media post with the `#AllThingsAgenticHackathon` hashtag.
- [ ] Double-check the actual Devpost submission deadline (Aug 31, 2026, 5:00pm PDT) and submit with margin, not at the last minute.
