# Aurevyn — Blueprint status (Jarvis commerce programme)

This document answers one question honestly: **how much of
`AUREVYN_JARVIS_COMMERCE_BLUEPRINT_V2` and the V3 update addendum is actually
built?**

The blueprint lists 1,000 numbered requirements. A catalogue entry is not proof
that a feature exists, so status is claimed only where code is in the repository.
Every capability below points at its implementing files, and
`tests/unit/jarvis-capabilities.test.ts` fails if an evidence path disappears.

Live view: **Admin → Jarvis control** (`/admin/jarvis`).

---

## 1. What changed in this pass

| Change | Why it matters |
| --- | --- |
| Supplier reference split into **reported** and **confirmed** | A pasted Meesho ID no longer advances the order or tells the customer "supplier confirmed". Confirmation requires a written evidence note. (§6.10–§6.11, §11) |
| `/admin/jarvis` command screen | One place showing what the store owes a customer now, plus every emergency switch and the capability audit. (§8) |
| Four independent pause switches | Listings, outbound messages, agents and automations can each be stopped without deleting data. Enforced in publish, notification queue, team cron and supplier sync. (§11) |
| Capability audit with evidence paths | Claims are tied to files and gaps are named in code, not in prose. (§13) |

New database columns on `supplier_orders`:
`referenceReportedAt`, `referenceReportedBy`, `referenceVerifiedAt`,
`referenceEvidence`. The migration backfills `referenceReportedAt` for existing
rows and deliberately leaves `referenceVerifiedAt` NULL — no confirmation is
invented for the past.

---

## 2. Status by blueprint area

| Blueprint area | Status | Reality |
| --- | --- | --- |
| §1 Mission & Meesho boundary | **Live** | No Meesho API, scraping or automated placement. The adapter queues the work and refuses to invent provider state. |
| §3 Roles & access | **Partial** | Admin-only panel, per-route `requireAdminWrite` guards with rate limits, customer data scoped to the session. No separate support-operator role that withholds cost/profit. |
| §4 Product intelligence & scoring | **Partial** | Evidence freshness, stock evidence, cost verification and completeness are computed per candidate; missing return-rate evidence caps a candidate at WATCH. No single `INSUFFICIENT_DATA` verdict or per-component confidence panel on a live product. |
| §4 Unit economics | **Live** | Every margin line carries a basis: supplier quote, configured, estimate, realised, unknown. Estimates cannot be read as realised profit. |
| §5 Listing & pricing automation | **Live** | Draft → gated publish through the validated product write path; margin floor enforced in the pricing engine and discount engine. |
| §6 Order workflow | **Live with one gap** | Intake, idempotency, snapshots, owner handoff, supplier reference provenance, evidence-backed confirmation, tracking and notifications all exist. The purchase sheet is stored per supplier order but is not yet a dedicated one-tap copy screen. |
| §7 Customer-visible states | **Partial** | Customer pages use the real order status; internal supplier cost, margin and admin notes never render. There is no per-state evidence panel for every state in the blueprint list. |
| §8 Command centre | **Partial** | Admin console + Jarvis control + team bench. No voice/chat surface (removed deliberately) and no per-run agent tool allowlists. |
| §9 24/7 architecture | **Partial** | Web on Vercel, durable row-locked job queue, cron endpoints for jobs and team cycles. No always-on worker; long work is bounded by function limits. |
| §9 Model router | **Blocked** | No LLM key configured. Assistant and AI-CEO degrade to deterministic output. See `docs/AI_PROVIDERS.md`. |
| §9 Memory | **Partial** | Curated in-repo knowledge with guardrails. No pgvector retrieval, no business/customer memory separation. |
| §10 Database entities | **Partial** | Orders, items, events, supplier orders, payments, refunds, returns, shipments, tracking, notifications, jobs, audit, settings, team cycles, sourcing candidates exist. Not modelled: `product_scores`, `price_observations`, `agent_runs`, `model_usage`, `approvals`, `security_events`, `knowledge_documents`, `memory_records`. |
| §11 Safeguards | **Mostly live** | No fabricated sales/returns/status; unique order identity; actor+time+source on state changes; customer isolation; margin assumptions shown; pause switches. Not done: restored-backup rehearsal. |
| §12 Implementation sequence | **Followed** | Audit → brand → order pipeline → customer page → evidence/scoring → notifications → agents → (blocked) model router. |
| §13 Requirement registry | **Partial** | Capability-level tracking with evidence, not 1,000 individual database rows. |

---

## 3. What only the owner can unblock

1. **UPI** — set the VPA in Admin → Settings → Payments, then verify one test payment. Until then `/api/health` reports `paymentsProvider: "NONE"`.
2. **LLM key** — add an OpenAI-compatible key (see `docs/AI_PROVIDERS.md`) before any model-routed agent work is possible.
3. **Backup rehearsal** — restore a Neon branch and record the recovery time; nothing in this repo can prove a restore works.
4. **Catalogue** — archive the remaining demo products and add real Meesho listings through Admin → Meesho sourcing → draft → publish.
5. **Cron scheduler** — point a scheduler at `/api/cron/jobs` and `/api/cron/team` with `CRON_SECRET`, otherwise the queue and team cycles only run when someone triggers them.

---

## 4. V3 addendum — what this pass added

Blueprint V3 adds governance: a controlled registry, sourced knowledge,
approvals, incidents, cost control, reporting and an evidence-based release
status. This pass built the parts that change behaviour, not just prose.

| V3 area | Status | Reality and evidence |
| --- | --- | --- |
| §1 Architecture / tool registry | **Partial** | Connector and agent-tool registry with permission levels, approval requirements and per-cycle budgets (`src/lib/jarvis/registry.ts`). No general task manager with scheduling; the planner in `src/lib/team/workflow.ts` still plans without dispatching tools. |
| §2 Knowledge system | **Live** | `knowledge_entries` table, 20 categories, source URL/title, publication date, verification date, confidence, recheck date. A VERIFIED entry is refused without an official/primary source and a date. Stale entries show “Needs recheck”. Admin: `/admin/jarvis/knowledge`. |
| §3 Meesho connector | **Disabled by design** | `MEESHO` is `DISABLED`, `MANUAL_OWNER`, with six PENDING policy checks and no source URL recorded. `connectorActivation()` cannot return ok. No order placement, catalogue call or scraping exists. |
| §4 Security architecture | **Partial** | Existing: password hashing, httpOnly sessions, CSRF, rate limits, role guards, hashed IPs, redacted logs, same-secret cron. Not claimed: MFA (provider not integrated), encryption at rest beyond the managed database, formal incident-response runbook. HTTPS is not described as end-to-end encryption. |
| §5 Privacy | **Partial** | Privacy/terms/shipping/returns policy pages exist; customer data reads are owner-scoped; analytics do not receive personal data. No automated retention job or self-service deletion request flow. |
| §6 Multi-agent orchestration | **Partial** | 119 specialists with roles and planning; tools now declare boundaries and budgets. Agents still cannot execute model-routed tool calls without an LLM key. |
| §7 Approval engine | **Live** | `/admin/jarvis` derives a live approval queue (supplier placement, unverified references, refunds, returns, unmatched UPI, drafts, failed jobs). Irreversible tools are denied without explicit approval. The queue never performs the action. |
| §8 Catalogue quality | **Partial** | Draft/publish gates, evidence and margin checks exist. Image-usage permission and a per-product last-verification date are not yet mandatory fields. |
| §9 Pricing and profit | **Live** | Every margin line carries a basis. The daily report separates collected payments (verified), order value (verified fact, not revenue), realised profit (UNKNOWN until finalised) and estimated profit (estimate). |
| §10 Original creative production | **Not started** | No Creative Agent output pipeline or asset-provenance labels. |
| §11 Website experience | **Live** | Editorial black/ivory design system, responsive layout, accessible focus handling, cached storefront pages. |
| §12 Customer support | **Partial** | Contact intake, order tracking, return/refund policy guidance and admin replies exist. No ticket SLA or support-operator role. |
| §13 Database reliability | **Partial** | Migrations, transactions, indexes and the deployment-environment guard exist. Backup/restore rehearsal is still not done. |
| §14 Testing and QA | **Partial** | Unit + integration tests run in CI locally; new modules have unit coverage. No end-to-end, accessibility or performance test suite. |
| §15 Incidents | **Live** | `jarvis_incidents` records reference, severity, service, evidence, occurrences and recovery note. Detection runs from `/admin/jarvis` or `GET/POST /api/cron/jarvis` (CRON_SECRET). Resolution requires a written note and is audited. |
| §16 Cost and resources | **Partial** | Per-tool call budgets, admin write budgets and rate limits. No provider usage ledger or hard spend cap because no LLM key exists. |
| §17 Daily operations | **Live** | `/admin/jarvis/report` and the “Today” card show verified / estimate / unknown for money, orders, fulfilment, catalogue, support and reliability. |
| §18 Implementation priorities | **Followed** | Audit → website → Jarvis → operations → integrations (blocked) → reliability. |
| §19 Principles | **Followed** | No fabricated data, no autonomy over money, no unapproved irreversible action. |
| §20 Acceptance criteria | **BLOCKED** | The computed status on `/admin/jarvis` is BLOCKED: payments are unconfigured and no backup restore has been rehearsed. `computeReleaseStatus()` never returns VERIFIED while a check is unknown or failed. |

New in this pass:

- `src/lib/jarvis/registry.ts` — connectors and agent tools, with activation and approval guards.
- `src/lib/jarvis/knowledge.ts` + `knowledge-service.ts` — validation, staleness, persistence, audit.
- `src/lib/jarvis/incidents.ts` — detection, de-duplication, acknowledgement, resolution.
- `src/lib/jarvis/approvals.ts` — the human approval queue.
- `src/lib/jarvis/report.ts` — the verified/estimate/unknown daily report.
- `src/lib/jarvis/readiness.ts` — the §20 release-status computation.
- `prisma/migrations/20261122190000_jarvis_governance` — additive tables `knowledge_entries`, `jarvis_incidents`.
- `/admin/jarvis/knowledge`, `/admin/jarvis/report`, and new sections on `/admin/jarvis`.
- `/api/cron/jarvis` (daily) for incident detection; added to `vercel.json`.

Deliberately not built: a Meesho API/scraper, an autonomous purchase path, a
creative-production pipeline, and any claim of production readiness without
owner evidence.

---

## 5. অসমীয়াত সাৰাংশ (Assamese summary)

এই পাছটোত তিনিটা মূল কাম হৈছে:

1. **Meesho অৰ্ডাৰ ID ৰ সত্যতা** — আগতে ID পেষ্ট কৰিলেই গ্ৰাহকক "supplier confirmed" কোৱা হৈছিল। এতিয়া পেষ্ট কৰাটো কেৱল **record** হয়; পিচত **প্ৰমাণ (evidence) লিখি confirm** নকৰালৈকে গ্ৰাহকক "confirmation pending" দেখুওৱা হয়। ইয়াৰ বাবে `supplier_orders` টেবুলত চাৰিটা নতুন কলাম যোগ হৈছে।
2. **Jarvis control পৃষ্ঠা** — `/admin/jarvis` ত এতিয়া দেখা যায়: কিমান অৰ্ডাৰত আপুনি নিজে Meesho অৰ্ডাৰ দিব লাগে, কিমান ID verify বাকী, কিমান supplier issue, আৰু job queue ত কিমান কাম বাকী।
3. **জৰুৰী pause switch চাৰিটা** — listing, গ্ৰাহকক যোৱা mail, agent, আৰু automation — প্ৰতিটো সুকীয়াকৈ বন্ধ কৰিব পাৰি। বন্ধ কৰিলে data নষ্ট নহয়, কেৱল সেই কামটো ৰয়।

**এতিয়াও আপুনি নকৰাকৈ বাকী:** UPI ID ছেট কৰা, LLM key দিয়া, backup restore পৰীক্ষা কৰা, পুৰণি demo product archive কৰি নতুন Meesho product publish কৰা, আৰু cron scheduler সংযোগ কৰা।

**V3 addendum ত এই পাছটোত যি যোগ হ’ল:**

- **Connector ৰেজিষ্ট্ৰি** — Meesho এতিয়াও `DISABLED`। ছটা policy প্ৰশ্নৰ এটাও উত্তৰ নাই, গতিকে কোনো ক’ডে ইয়াক সক্ৰিয় কৰিব নোৱাৰে। Meesho ৰ order আপুনি নিজে দিয়েই থাকিব।
- **জ্ঞান ভাণ্ডাৰ** (`/admin/jarvis/knowledge`) — প্ৰতিটো তথ্যৰ লগত source ৰ URL, তাৰিখ আৰু confidence থাকে। “Verified” কেৱল চৰকাৰী/মূল উৎস থকালৈকে; পুৰণি হ’লে “Needs recheck” দেখুৱায়।
- **Approval তালিকা** — কিমান Meesho order দিব লাগে, কিমান ID verify বাকী, refund/return, UPI match — সকলো `/admin/jarvis` ত এখন তালিকাত।
- **Incident লগ** — ক’ৰবাত কাম বিফল হ’লে severity, সময়, প্ৰমাণসহ incident ৰেকৰ্ড হয়; সমাধান লিখিলেহে বন্ধ হয়।
- **দৈনিক rিপ’ৰ্ট** (`/admin/jarvis/report`) — প্ৰতিটো সংখ্যাৰ লগত “Verified / Estimate / Unknown” লেবেল। অনুমান কেতিয়াও প্ৰকৃত লাভ হিচাপে দেখুওৱা নহয়।
- **Platform status** — V3 §20 অনুসাৰে এতিয়া `BLOCKED`: কাৰণ UPI ছেট নাই আৰু backup restore পৰীক্ষা হোৱা নাই। এই দুটা আপুনি নকৰালৈকে “Production ready” কেতিয়াও নেদেখুৱায়।

**সৎ কথা:** blueprint ৰ ১,০০০ খণ্ডৰ প্ৰতিটো feature এতিয়া নাই। যি আছে, তাৰ ক’ড file উল্লেখসহ তালিকা এই ডকুমেণ্টত আছে; যি নাই, তাৰ কাৰণো লগে লগে লিখা আছে।
