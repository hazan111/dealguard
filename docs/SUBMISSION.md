# DealGuard — Devpost Submission Draft

Copy each section into the corresponding Devpost form field for the All Things Agentic Hackathon.

---

## Project Name
DealGuard

## Tagline
A solo acquisition entrepreneur shouldn't need a Fortune 500 deal team to diligence their first acquisition.

## Category
The Fortified Enterprise Fleet

## Text Description

### The problem
An acquisition entrepreneur ("searcher") raises capital to find, acquire, and run a single privately held company — without the in-house legal, finance, HR, and IP departments a corporate acquirer would have behind them. Due diligence on that acquisition still generates hundreds of documents over weeks — contracts, financials, HR records, patent filings — and a searcher doing this largely alone has no single view of the full picture. Cross-domain risks (a legal clause and a financial exposure tied to the same customer, for instance) get missed when one person reviews each domain in isolation, and diligence data is some of the most sensitive information a business handles — any tool touching it needs provable access boundaries and resistance to malicious content hidden inside submitted documents. A large corporate acquirer can absorb this with headcount. A solo searcher cannot.

### The solution
DealGuard is a fleet of five independently deployed, independently registered agents — an Orchestrator plus four domain specialists (Legal, Financial, HR/Compensation, IP) — standing in for the departments a searcher doesn't have. It watches a live Google Drive "data room," routes each incoming document to the right specialist in real time, and maintains a single evolving risk register across the weeks a deal takes to close. When two documents from different domains point at the same underlying risk, the Orchestrator links them — a pattern a solo reviewer, splitting attention across every domain themselves, would likely miss. Every finding carries a citation back to its source and requires human sign-off before it can be marked resolved; DealGuard recommends, it never decides. All submitted documents are screened by Model Armor before any agent reasoning touches them, specifically to catch prompt-injection attempts embedded in malicious documents — demonstrated live with a document containing hidden text instructing the system to mark all risks as cleared.

### Features and functionality
- Real-time document ingestion from a Google Drive data room (push notifications, not polling)
- Five independently deployed, independently registered agents communicating over A2A
- Cross-domain risk linking that persists and evolves across a multi-week deal timeline
- Model Armor-screened document intake, blocking prompt-injection and PII-leak attempts before agent reasoning
- Per-agent zero-trust identity scoping (Legal agent cannot see HR documents, etc.)
- A citation-backed, human-approval-required risk register dashboard
- Automatic drafting of a real "Schedule of Exceptions" Google Doc for disclosed findings — the deal team's actual next artifact, not just an internal report
- A full audit trail of every document ingested, every finding created or updated, and every blocked injection attempt
- A daily spoken-audio briefing of the deal's current risk state

### Technologies used
Google ADK (Python), A2A protocol, Gemini 3.5 Flash (Vertex AI), Vertex AI Agent Engine (Agent Runtime), Agent Registry, Agent Identity, Model Armor, Cloud Run, Firestore, Google Drive API, Cloud Text-to-Speech, React, Vite, Tailwind CSS, shadcn/ui.

### Other data sources used
Six entirely fictional deal documents (merger agreement draft, financial statements, executive compensation summary, patent portfolio listing, a litigation update, and a financial addendum containing an embedded prompt-injection attempt) authored specifically for this project's demo. No real company, deal, or individual is represented.

### Why this isn't "just another AI due-diligence tool"
A mature, well-funded market of AI-powered M&A due-diligence products already exists (Harvey, Kira, Luminance, Spellbook, and others) — we are not claiming to have invented AI-assisted diligence, and a judge who knows this space should not be misled into thinking otherwise. What those products are, almost without exception, is a single model doing document analysis behind a UI. DealGuard is not pitched as a competitor to them as a product. It is a demonstration of a specific architecture pattern this hackathon track asks for: a genuinely governed, independently registered, cross-department multi-agent fleet — real Agent Identity per agent, real Agent Registry cataloging, real Model Armor screening malicious input — rather than one model with a prompt. M&A is the vehicle used to make that architecture concrete and demoable, not the product claim itself.

Three concrete differences from the existing commercial category, not just framing:
1. **Continuous vs. batch.** The category's tools (Kira, Luminance, Spellbook) are upload-and-analyze — a point-in-time batch review. DealGuard watches a live data room continuously over the deal's full multi-week timeline, with the risk register evolving as new documents arrive, rather than producing a single static report.
2. **Malicious-document defense.** None of the reviewed commercial tools advertise resistance to adversarial content embedded in submitted documents — most of that category predates prompt-injection as a mainstream security concern. DealGuard screens every document through Model Armor before any agent reasoning touches it, demonstrated live against a document containing a hidden instruction-override attempt.
3. **Real per-agent identity with an IAM-enforced zero-trust boundary.** The commercial tools run on their own closed SaaS stacks. Each DealGuard agent runs on Agent Engine under its **own dedicated Google Cloud service account** — five separate, auditable identities. The zero-trust boundary is enforced at the IAM level, not just in application code: only the Orchestrator's identity holds access to the risk-register Firestore database; the four specialists' identities hold a *conditional* grant scoped exclusively to the A2A task-store database, so a specialist agent is cryptographically unable to read the register or another domain's documents. Document routing (Legal agent only ever receives legal-classified content) is additionally enforced at the gateway. The platform's Agent Identity API surface (authProviders) is enabled on the project; adopting it beyond IAM service accounts is listed under Known Limitations.

### Why an acquisition entrepreneur — and why this needs a fleet, not a script
DealGuard is deliberately not built for a corporate M&A department — a large acquirer already has in-house legal, finance, HR, and IP teams, and a single-agent tool would just be one more input to a process they already staff. It's built for the searcher: the one person who doesn't have any of those departments and is personally on the hook for reviewing all four domains across a live, weeks-long deal. That's also why this genuinely needs five separate, delegating agents rather than one script with branching logic — a solo searcher's actual gap is the absence of four different kinds of specialist judgment running in parallel, not a single reviewer who needs a faster read speed.

### Platform depth actually reached (verified live, not assumed)
- **All five agents run on Vertex AI Agent Engine with the platform's native A2A template** — Agent Engine itself serves each agent's A2A HTTP+JSON endpoint (`{engine}/a2a/v1/message:send` + task polling). The fleet's inter-agent protocol is not simulated on a side server; it is Agent Runtime speaking A2A.
- **Agent Registry auto-cataloging:** A2A agents deployed on Agent Engine are automatically materialized in Agent Registry (reasoningEngines URNs) — and we also exercised and documented the manual `services.create` + `A2A_AGENT_CARD` registration path.
- **Replica-safe A2A:** Agent Engine replicas are ephemeral, so the default in-memory A2A task store loses the task between send and poll (verified live: "Task not found"). We shipped a Firestore-backed TaskStore in a dedicated database, which is also what the specialists' conditional IAM grant is scoped to.
- **Model Armor in depth:** a short injection hidden inside a long, legitimate document *passes* a whole-document scan — the benign context dilutes the classifier signal. The gateway therefore screens the full text AND overlapping chunks; the poisoned demo document is blocked by the chunk pass. This dilution effect and the chunked-screening mitigation are exactly the kind of practical guardrail engineering the track asks about.

### Findings and learnings
DealGuard's four specialist agents deliberately mirror the departments a corporate acquirer would staff in-house (a CFO/finance lead, a general-counsel/legal lead, an HR lead, and a technical/IP lead) — standing in for exactly what a solo acquisition entrepreneur doesn't have — and each agent's reasoning is grounded in recognized industry red-flag patterns rather than open-ended judgment — for example, flagging customer concentration against the widely used 20–25% single-customer threshold, or recognizing the common real-world pattern of IP created by an individual founder without a signed assignment agreement. Every finding also carries a `recommended_action` drawn from the standard M&A resolution taxonomy (re-trade, escrow, indemnity, walk-away, or monitor) — the same vocabulary a real deal team uses to turn a finding into contract language. This grounding is what separates a finding a domain professional would recognize from a generic LLM guess.

Before writing any code, we verified — directly against a live Google Cloud project rather than assuming from documentation — which Gemini Enterprise Agent Platform components were actually accessible. Agent Registry, Agent Identity, Model Armor, and Agent Runtime (Vertex AI Agent Engine) were confirmed working; Agent Gateway turned out to be Private Preview and unavailable on a standard project, so we built a lightweight substitute instead of quietly pretending otherwise. We think that verification-first discipline — and being upfront about the one component we couldn't use natively — is itself a meaningful part of what "production-minded" agent engineering looks like, rather than something to hide in a submission.

We also treated inter-agent failure as a first-class design question rather than an afterthought: every specialist call has a bounded timeout and a single retry, structured outputs are schema-validated before being accepted, and — critically — a finding whose citation can't be verified against the source document is never written to the risk register as a confirmed finding; it's routed to a `needs_review` state instead. A specialist that fails twice goes to a dead-letter queue for human review rather than silently dropping the document. This is what lets us answer, concretely, what happens if a worker agent hallucinates or loops — rather than assuming it never will.

### Known limitations, risks, and future improvements
- Agent Gateway (Google's native policy-enforcement component) was not accessible on our project during the hackathon (Private Preview); we built and disclosed a custom Cloud Run-based substitute instead.
- Per-agent identity is enforced through dedicated IAM service accounts (including a conditional grant that walls specialists off from the risk register at the IAM level); adopting the Agent Identity authProviders/SPIFFE surface on top of that is a natural next step beyond hackathon scope.
- The poisoned-document flow blocks the ENTIRE document and routes it to human review (the disclosed simpler fallback from our design doc) rather than stripping the injection and processing the remaining legitimate content.
- Cross-domain risk linking uses lightweight entity/keyword matching rather than a full semantic-similarity system — sufficient for the demo's scenario, not yet robust for arbitrary real-world document sets.
- Drive API watch channels expire and require renewal; the hackathon build implements basic renewal, not a production-grade system.
- The system is a decision-support tool, not a decision-maker: every finding requires human review and sign-off before being marked resolved.
- Unlike mature commercial due-diligence tools, DealGuard does not yet benchmark findings against a large library of market-standard clause language (e.g. Kira's pretrained clause library), does not reconcile financial statements against underlying ledger data, does not integrate natively into the tools deal teams already use (Word, Datasite, Intralinks), and assumes English-language documents only. These are all legitimate, larger-scope additions a production version would need — the hackathon build's focus was the agent-fleet governance architecture, not feature parity with an established DD product category.

### AI Tools Disclosure
Gemini 3.5 Flash powers all five agents' reasoning, document classification, cross-domain finding synthesis, and the daily briefing script generation. AI-assisted development tools were used in writing the codebase, consistent with what the hackathon rules permit.

### Team Contributions
Solo submission — all design, product decisions, and implementation by the entrant.

---

## Bonus Category Submissions

### Blog/video content
A short write-up (or video) covering how DealGuard was built — the platform-access verification process, the five-agent architecture, and the Agent Gateway substitution decision — published publicly (e.g. dev.to or a YouTube video), explicitly stating it was created for the purposes of entering the All Things Agentic Hackathon.

### Social media post
A post on X or LinkedIn highlighting DealGuard, including the hashtag `#AllThingsAgenticHackathon`.
