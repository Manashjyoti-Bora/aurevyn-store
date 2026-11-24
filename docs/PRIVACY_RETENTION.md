# Aurevyn — data retention and deletion

Blueprint reference: **V4 §5 (Privacy and compliance)** — “retain only necessary
personal data; define deletion and retention policy” — and **V5 §12.5 / §13**
(retention periods, privacy of logs).

This document describes what the code actually deletes. It is not legal advice;
have a professional review your retention periods against the records you are
required to keep.

---

## 1. Two different things

| Flow                 | Trigger                                                                                 | What happens                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer erasure** | The customer themself: Account → Delete account, typed confirmation `DELETE` + password | Login identity is anonymised, sessions/tokens/addresses/cart/wishlist/notifications deleted. Order and payment records stay, with the person no longer identifiable. `src/lib/account/deletion.ts`, `POST /api/account/delete`. |
| **Retention sweep**  | Cron, once a day                                                                        | Deletes old diagnostic and already-closed rows across the store. Never touches a sale. `src/lib/privacy/retention.ts` + `src/lib/privacy/service.ts`.                                                                           |

Both write an audit entry. The erasure entry deliberately stores no e-mail
address, so the audit trail does not recreate the identifier that was erased.

---

## 2. Retention periods (enforced)

`RETENTION_POLICIES` in `src/lib/privacy/retention.ts` is the single source of
truth; the table below mirrors it.

| Dataset            | Kept     | Basis          | Why                                                                                                  |
| ------------------ | -------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `error_logs`       | 30 days  | diagnostic     | Long enough to diagnose a regression.                                                                |
| `api_logs`         | 30 days  | diagnostic     | Sanitised request/response bodies for debugging; one release cycle.                                  |
| `webhook_events`   | 180 days | reconciliation | Only `PROCESSED`, `DUPLICATE` and `REJECTED` rows, so an unresolved provider event is never dropped. |
| `contact_messages` | 180 days | support        | Only `RESOLVED` threads. `NEW` and `READ` are never pruned by a timer.                               |
| `team_cycles`      | 90 days  | diagnostic     | Counts only; briefings cascade with their cycle.                                                     |
| `audit_logs`       | 730 days | security audit | An incident or disputed admin action can still be reconstructed.                                     |

Changing a period means editing one array and updating this table. The unit
suite (`tests/unit/retention.test.ts`) asserts that every dataset has a unique
name, a positive whole-day period and a written reason.

---

## 3. Never pruned by the sweep

- `orders`, `order_items`, `order_events` — financial and consumer-protection record.
- `payments`, `refunds`, `returns` — must stay reconcilable against the bank.
- `shipments`, `tracking_events` — delivery evidence for disputes and warranty.
- `supplier_orders` — owner attestation and supplier-reference provenance.
- Contact messages that are still `NEW`.

Erasing a sale is not a privacy win: it destroys the business's own evidence of
what was charged, refunded and delivered while the account itself is already
anonymous. `NEVER_PRUNED` lists these with the reason, next to the code.

Other housekeeping already existed and is unchanged: expired sessions, expired
password-reset tokens, abandoned anonymous carts and expired rate-limit buckets
(`purgeExpiredSessions`, `purgeExpiredRateLimitBuckets`, `/api/cron/jobs`).

---

## 4. How the sweep runs

Three ways, all using the same code path:

1. **Daily, automatic** — `/api/cron/jobs` (Vercel Cron, `17 0 * * *`) runs the
   sweep after job processing; the JSON response includes `retention` counts.
2. **Dedicated endpoint** — `GET|POST /api/cron/retention` with
   `Authorization: Bearer $CRON_SECRET`, for an external scheduler
   (cron-job.org, GitHub Actions) or a manual run.
3. **From the code** — `runRetentionSweep()`.

Each dataset is deleted independently. A failure in one table is collected in
`failed[]`, logged and reported; the other datasets still run, and the audit
entry records the failure so it is not silent.

### Verify it

```bash
curl -s -X POST https://<your-domain>/api/cron/retention \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

Expect `{ "ok": true, "retention": { "deleted": {...}, "totalDeleted": n, "failed": [] } }`.
A 503 means `CRON_SECRET` is not configured on that deployment; a 401 means the
secret did not match.

---

## 5. What this does not do

- **No per-customer export or scheduled erasure request flow.** Erasure is
  immediate and self-service, not queued for review.
- **No encryption at rest beyond the managed database.** Retention is not
  encryption.
- **No automatic deletion of staff accounts.** Staff are closed by another
  administrator; the same anonymisation rules do not silently apply.
- **No backup pruning.** Neon keeps its own backup window; deleting a row here
  does not rewrite an existing backup. Check your plan's retention if that
  matters to you.
