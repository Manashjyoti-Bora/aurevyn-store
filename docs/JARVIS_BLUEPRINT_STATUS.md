# Aurevyn — Blueprint status (Jarvis commerce programme)

This document answers one question honestly: **how much of
`AUREVYN_JARVIS_COMMERCE_BLUEPRINT_V2` is actually built?**

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

## 4. অসমীয়াত সাৰাংশ (Assamese summary)

এই পাছটোত তিনিটা মূল কাম হৈছে:

1. **Meesho অৰ্ডাৰ ID ৰ সত্যতা** — আগতে ID পেষ্ট কৰিলেই গ্ৰাহকক "supplier confirmed" কোৱা হৈছিল। এতিয়া পেষ্ট কৰাটো কেৱল **record** হয়; পিচত **প্ৰমাণ (evidence) লিখি confirm** নকৰালৈকে গ্ৰাহকক "confirmation pending" দেখুওৱা হয়। ইয়াৰ বাবে `supplier_orders` টেবুলত চাৰিটা নতুন কলাম যোগ হৈছে।
2. **Jarvis control পৃষ্ঠা** — `/admin/jarvis` ত এতিয়া দেখা যায়: কিমান অৰ্ডাৰত আপুনি নিজে Meesho অৰ্ডাৰ দিব লাগে, কিমান ID verify বাকী, কিমান supplier issue, আৰু job queue ত কিমান কাম বাকী।
3. **জৰুৰী pause switch চাৰিটা** — listing, গ্ৰাহকক যোৱা mail, agent, আৰু automation — প্ৰতিটো সুকীয়াকৈ বন্ধ কৰিব পাৰি। বন্ধ কৰিলে data নষ্ট নহয়, কেৱল সেই কামটো ৰয়।

**এতিয়াও আপুনি নকৰাকৈ বাকী:** UPI ID ছেট কৰা, LLM key দিয়া, backup restore পৰীক্ষা কৰা, পুৰণি demo product archive কৰি নতুন Meesho product publish কৰা, আৰু cron scheduler সংযোগ কৰা।

**সৎ কথা:** blueprint ৰ ১,০০০ খণ্ডৰ প্ৰতিটো feature এতিয়া নাই। যি আছে, তাৰ ক’ড file উল্লেখসহ তালিকা এই ডকুমেণ্টত আছে; যি নাই, তাৰ কাৰণো লগে লগে লিখা আছে।
