# Owner runbook — Zenvora store

Everything the owner has to do to run this store, in order. Nothing here needs a
developer, and no payment API keys exist to manage: payments are UPI QR and Cash
on Delivery only.

> Never paste a secret into chat, an issue or a commit. Environment values go
> into your host's dashboard (Vercel → Settings → Environment Variables), and
> the store UPI ID is safest entered in **Admin → Settings** because it is not a
> secret and needs no redeploy.

## 1. What the site needs to be live

| Setting | Where | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | host env | yes | PostgreSQL (Neon/Supabase/RDS). Applied with `npm run db:deploy` once per deploy. |
| `APP_URL` | host env | yes | The real public origin, e.g. `https://zenvorastore.vercel.app`. Used by emails, canonical/OG tags, sitemap. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | host env | yes | First-boot admin account. Change the password after first sign-in. |
| `SESSION_SECRET` | host env | yes | Random 32+ characters. |
| **Store UPI ID** | **Admin → Settings → Payments** | to accept prepaid | The QR pays this VPA. Leave blank to offer COD only. `UPI_VPA` in env overrides it. |
| `SMTP_*` + `EMAIL_PROVIDER=smtp` | host env | for email | Without it, order/refund emails are only written to server logs. |
| `PAYMENTS_TEST_MODE` | host env | — | Leave `false`. It can never activate in a production build. |
| `CRON_SECRET` | host env | recommended | Protects `/api/cron/jobs` (Vercel cron entry lives in `vercel.json`). |

Business identity (legal name, GSTIN, address), support email/phone, COD toggle
and policy windows live in **Admin → Settings**. Fill them before taking money —
invoices, policy pages and the AI co-founder read from them.

## 2. First launch checklist

1. `npm run db:deploy` against the production database (or let the release build
   do it), then `npm run db:create-admin` if no admin exists.
2. Sign in at `/admin` and set: business identity, support email, COD on/off,
   **store UPI ID**, shipping rates, return/cancellation windows.
3. Replace the 8 demo products with real ones (Admin → Products). Demo products
   are why `demoMode` is still on; turn it off in Admin → Settings only when the
   catalogue, prices and images are real and licensed.
4. Place one real ₹1 order, pay it by UPI, and confirm it with **Mark received**
   in Admin → Payments (see `docs/PAYMENT_SETUP.md`).
5. Check `/api/health` returns `status: "ok"`, `paymentsConfigured: true`, and
   `emailConfigured: true`.

## 3. Daily operations (5 minutes)

- **Admin → Payments** — confirm UPI references against the bank statement.
  Confirm only what is visible as a credit.
- **Admin → Orders** — fulfil paid orders; mark COD cash collected after
  delivery.
- **Admin → Refunds** — pay refunds out, then *Settle manually* with the payout
  reference.
- **Admin → Health** — database, payments, email and launch blockers.
- **Admin → Operations** — job queue, supplier sync and automation posture.

## 4. Deploying changes

- Push to `main`. CI runs typecheck, lint, tests and a release build against a
  throw-away PostgreSQL service; the host then deploys.
- The release build applies pending Prisma migrations (`prisma migrate deploy`).
  Never edit an applied migration — add a new one.
- Payment configuration changed? Nothing to redeploy: change the UPI ID in
  Admin → Settings.

## 5. Honest limits

- UPI money is confirmed by you, not by software. The store never marks a UPI
  order paid automatically, and there is no webhook.
- Refunds are manual. There is no API to reverse a UPI transfer.
- Real product photography must be owned or licensed. AI-generated product
  images would misrepresent the goods and must not be used as catalogue photos.
