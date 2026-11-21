# Nirvora — the autonomous team

Status: **implemented and tested**. Eight agents read the store on a schedule,
rank what needs doing and store a briefing per cycle. They do not publish
products, change prices, refund money, message customers or edit settings.

`/admin/team` is the console. It shows each agent's current briefing, the exact
limits of its mandate and the stored cycle log.

---

## 1. Why a team and not one assistant

An "AI CEO" that answers questions is a chatbot. A store needs eight different
questions answered at the same time, and they conflict: growth wants more
promotion, finance wants fewer refunds, fulfilment wants fewer promises.
Separating the mandates makes each complaint specific and auditable.

| Agent    | Role                      | The question it owns                           | Cron            |
| -------- | ------------------------- | ---------------------------------------------- | --------------- |
| Orion    | Chief of Staff            | What is stopping the store making money today? | `0 */3 * * *`   |
| Vesper   | Catalogue & Merchandising | Is every product good enough to sell?          | `15 */6 * * *`  |
| Kaizen   | Pricing & Margin          | Is any order quietly losing money?             | `30 */6 * * *`  |
| Lumen    | Growth & Discovery        | Can a stranger find, trust and buy?            | `45 */12 * * *` |
| Anchor   | Customer Care             | Is a customer waiting on us?                   | `10 */3 * * *`  |
| Sentinel | Reliability               | Is anything broken or unconfigured?            | `20 */3 * * *`  |
| Ledger   | Finance                   | Does the ledger match the bank?                | `40 */12 * * *` |
| Atlas    | Fulfilment & Supply       | Can we ship what we sold?                      | `50 */6 * * *`  |

Each schedule is recorded on the agent and displayed in the console. The actual
trigger is described in §4.

## 2. How a briefing is produced

```
Prisma (bounded SELECTs)
        │
        ▼
src/lib/team/signals.ts   TeamSignals — counts, sums, product cost rows
        │                 no names, e-mails, phones or addresses
        ▼
src/lib/team/briefings.ts pure: signals → 8 × AgentBriefing
        │                 (status, headline, summary, findings,
        ▼                  priorities, what the system already handles)
src/lib/team/service.ts   runTeamCycle(): store one cycle + 8 briefings
        │
        ├── /api/cron/team        (CRON_SECRET)
        ├── /api/cron/jobs        (daily cycle piggyback)
        └── /api/admin/team/run   (owner, ADMIN only, 4/min)
```

Two properties matter:

- **Deterministic.** The same signals always produce the same briefing; the
  `team-briefings` unit suite proves it. No language model sits between the
  database and the number.
- **Evidence-labelled.** Every finding is `VERIFIED` (read from a record) or
  `DERIVED` (arithmetic over records). A value that cannot be measured is not
  shown as zero.

## 3. What "hands free" means here

Each agent's card lists two things:

- **Works on its own** — reading, detecting, ranking, queueing safe work.
- **Reserved for the owner** — publishing, pricing, refunding, customer
  messaging, environment changes.

That boundary is enforced in the roster and asserted in the unit tests: no
agent's autonomous scope may contain publish/pricing/refund language. The cycle
writes only to `team_cycles` and `team_briefings`; business tables are untouched.

## 4. Running it 24×7

The cycle endpoint is secret-guarded, so any scheduler works:

```bash
curl -X POST https://<your-domain>/api/cron/team \
  -H "Authorization: Bearer $CRON_SECRET"
```

- **Vercel Cron** already calls `/api/cron/jobs` daily; that route also runs one
  team cycle, so the log is never empty even on a minimal setup.
- For true three-hourly cycles, add an external scheduler (cron-job.org,
  GitHub Actions schedule, UptimeRobot) pointing at `/api/cron/team`. Vercel's
  Hobby plan only guarantees daily cron, so the endpoint stays scheduler-neutral.
- Running it from the console ("Run the team now") is rate-limited per admin and
  produces the same stored cycle with trigger `OWNER`.

## 5. Data model

| Table            | Purpose                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `team_cycles`    | one row per run: trigger, counts, duration                                                 |
| `team_briefings` | one row per agent per cycle: status, headline, summary, findings (JSON), priorities (JSON) |

Both are additive and indexed by `createdAt`; the migration is
`prisma/migrations/20261121180000_autonomous_team`.

## 6. Honest limits

- The agents reason over the records the store already holds. If an order was
  taken offline or a payment confirmed in a bank app, the team cannot see it
  until it is recorded.
- Briefings are recommendations with numbers, not forecasts. No conversion,
  demand or profit figure is invented.
- The optional LLM narrative layer (`docs/AI_CEO.md`) is separate and off by
  default. The team works with no model provider and no API key.
